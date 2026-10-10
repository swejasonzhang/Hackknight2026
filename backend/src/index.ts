import { createApp } from './app.ts'
import { connectDb, connectWithRetry, describeUri, type DbHandle } from './db.ts'
import { loadEnv } from './env.ts'

loadEnv()

const port = Number(process.env.PORT ?? 8787)
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!process.env.JWT_SECRET) {
  console.error('[api] JWT_SECRET is not set. Add a long random string to .env (see .env.example).')
  process.exit(1)
}
if (!process.env.CV_API_KEY) {
  console.warn('[api] CV_API_KEY is not set: the computer-vision module cannot store sessions until it is.')
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('[api] MONGODB_URI is not set. Put the MongoDB Atlas connection string in .env at the repo root (see .env.example).')
  process.exit(1)
}

// The HTTP server starts at once so /api/health answers (db: "disconnected") and data routes return
// 503 while MongoDB is unreachable; the connection is retried forever in the background. Exiting on
// a database outage only put the host into a restart loop with the API unreachable meanwhile.
const RETRY_MS = 10_000
let database: DbHandle | null = null
void connectWithRetry(() => connectDb(uri), {
  maxAttempts: Infinity,
  delayMs: RETRY_MS,
  onError: (err, attempt) => {
    console.error(`[api] ${err instanceof Error ? err.message : String(err)}`)
    console.error(`[api] retrying in ${RETRY_MS / 1000} s (attempt ${attempt})`)
  },
}).then((handle) => {
  database = handle
  console.log(`[api] database: ${handle.label}`)
})

const app = createApp({ corsOrigins })
// 0.0.0.0 = every network interface, so the API is reachable from other devices too.
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[api] listening on http://localhost:${port} (all interfaces)`)
  console.log(`[api] connecting to MongoDB at ${describeUri(uri)}…`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] ${signal} received, shutting down`)
  server.close()
  await database?.stop()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
