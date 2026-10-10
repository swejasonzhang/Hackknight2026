import pg from 'pg'
import { migrate } from './schema.ts'

/** The minimal query surface the store modules use; a pool, a transaction or a test database all satisfy it. */
export interface Queryable {
  query<T extends object = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>
}

export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>
  close(): Promise<void>
}

let current: Db | null = null

/** Installs the database the app uses. index.ts sets the Postgres pool; test/setup.ts sets an in-process PGlite. */
export function setDb(next: Db | null): void {
  current = next
}

export function db(): Db {
  if (!current) throw new Error('Database is not connected')
  return current
}

export interface DbHandle {
  /** Connection string with the password masked, safe to log. */
  label: string
  /** True when the TimescaleDB extension is active and `reps` is a hypertable. */
  timescale: boolean
  stop(): Promise<void>
}

/** postgres://user:secret@host:5432/tsdb -> postgres://user:***@host:5432/tsdb */
export function describeUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@')
}

export type SslConfig = false | { rejectUnauthorized: boolean }

/**
 * Takes `sslmode` out of a Postgres URL and turns it into node-postgres' `ssl` option, with
 * libpq's meaning: `require` encrypts without checking the certificate, `verify-ca`/`verify-full`
 * check it, `disable` turns TLS off. Without an sslmode, local hosts are plain and remote hosts
 * are encrypted. Tiger Cloud hands out URLs ending in `?sslmode=require`.
 */
export function splitSslMode(url: string): { connectionString: string; ssl: SslConfig } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { connectionString: url, ssl: false }
  }
  const mode = parsed.searchParams.get('sslmode')
  parsed.searchParams.delete('sslmode')
  const local = ['localhost', '127.0.0.1', '[::1]', ''].includes(parsed.hostname)
  let ssl: SslConfig
  switch (mode) {
    case 'disable':
      ssl = false
      break
    case 'verify-ca':
    case 'verify-full':
      ssl = { rejectUnauthorized: true }
      break
    case null:
      ssl = local ? false : { rejectUnauthorized: false }
      break
    default:
      ssl = { rejectUnauthorized: false }
  }
  return { connectionString: parsed.toString(), ssl }
}

function rows<T extends object>(result: pg.QueryResult<pg.QueryResultRow>): T[] {
  return result.rows as T[]
}

/** Wraps a node-postgres pool as a Db. */
export function pgDb(pool: pg.Pool): Db {
  return {
    query: async (text, params) => rows(await pool.query(text, params as unknown[])),
    transaction: async (fn) => {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const result = await fn({ query: async (text, params) => rows(await client.query(text, params as unknown[])) })
        await client.query('commit')
        return result
      } catch (err) {
        await client.query('rollback').catch(() => undefined)
        throw err
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

/**
 * Connects to the Postgres / TimescaleDB service named by DATABASE_URL, applies the schema and
 * installs it as the app database. There is no fallback: a missing or unreachable database stops
 * the server with a clear message. (Tests never come here; they run an in-process PGlite.)
 */
export async function connectDb(url: string | undefined): Promise<DbHandle> {
  if (!url) {
    throw new Error('DATABASE_URL is not set. Put the Tiger Cloud (TimescaleDB) connection string in .env at the repo root (see .env.example).')
  }
  const label = describeUri(url)
  const { connectionString, ssl } = splitSslMode(url)
  const pool = new pg.Pool({ connectionString, ssl, max: 8, connectionTimeoutMillis: 10_000 })
  pool.on('error', (err) => console.error(`[api] database pool error: ${err.message}`))
  const handle = pgDb(pool)
  let timescale: boolean
  try {
    timescale = (await migrate(handle)).timescale
  } catch (err) {
    await pool.end().catch(() => undefined)
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not connect to Postgres at ${label}: ${reason}. Check the connection string, the password, and that the service is running.`)
  }
  setDb(handle)
  return {
    label,
    timescale,
    stop: async () => {
      setDb(null)
      await pool.end()
    },
  }
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
