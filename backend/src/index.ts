import { createApp } from './app.ts'
import { connectDb, connectWithRetry, type DbHandle } from './db.ts'
import { loadEnv } from './env.ts'

loadEnv()

const port = Number(process.env.PORT ?? 8787)
const isProduction = process.env.NODE_ENV === 'production'
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('[api] MONGODB_URI is not set. Put the MongoDB Atlas connection string in .env at the repo root (see .env.example).')
  process.exit(1)
}

// Keep trying in development (fix the Atlas access list or your Wi-Fi and it connects by itself);
// in production give up after a minute so the host restarts the process.
const RETRY_MS = 10_000
let db: DbHandle
try {
  db = await connectWithRetry(() => connectDb(uri), {
    maxAttempts: isProduction ? 6 : Infinity,
    delayMs: RETRY_MS,
    onError: (err, attempt, max) => {
      console.error(`[api] ${err instanceof Error ? err.message : String(err)}`)
      console.error(`[api] retrying in ${RETRY_MS / 1000} s (attempt ${attempt}${Number.isFinite(max) ? ` of ${max}` : ''})`)
    },
  })
} catch (err) {
  console.error(`[api] giving up: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}

const app = createApp({ corsOrigins })
// 0.0.0.0 = every network interface, so the API is reachable from other devices too.
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[api] listening on http://localhost:${port} (all interfaces)`)
  console.log(`[api] database: ${db.label}`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] ${signal} received, shutting down`)
  server.close()
  await db.stop()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
