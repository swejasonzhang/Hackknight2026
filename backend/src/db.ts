import mongoose from 'mongoose'

export interface DbHandle {
  /** Connection string with the password masked, safe to log. */
  label: string
  stop(): Promise<void>
}

/** mongodb+srv://user:secret@cluster.example.net/db -> mongodb+srv://user:***@cluster.example.net/db */
export function describeUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@')
}

/**
 * Connects Mongoose to the hosted MongoDB cluster named by MONGODB_URI.
 * There is no fallback: a missing or unreachable database stops the server with a clear message.
 * (Tests never come here; they start their own throwaway instance in test/setup.ts.)
 */
export async function connectDb(uri: string | undefined): Promise<DbHandle> {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Put the MongoDB Atlas connection string in .env at the repo root (see .env.example).',
    )
  }
  const label = describeUri(uri)
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Could not connect to MongoDB at ${label}: ${reason}. Check the connection string, the database user and password, and the Atlas "Network Access" IP list.`,
    )
  }
  return { label, stop: () => mongoose.disconnect() }
}

export interface RetryOptions {
  /** Use Infinity to keep trying until the database appears. */
  maxAttempts: number
  delayMs: number
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>
  /** Called after each failed attempt that will be retried. */
  onError?: (err: unknown, attempt: number, maxAttempts: number) => void
}

/** Runs `connect` until it succeeds, waiting `delayMs` between attempts; rethrows the last error when attempts run out. */
export async function connectWithRetry<T>(connect: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  for (let attempt = 1; ; attempt++) {
    try {
      return await connect()
    } catch (err) {
      if (attempt >= opts.maxAttempts) throw err
      opts.onError?.(err, attempt, opts.maxAttempts)
      await sleep(opts.delayMs)
    }
  }
}
