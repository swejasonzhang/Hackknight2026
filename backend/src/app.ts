import cors from 'cors'
import express, { type Express } from 'express'
import { authenticate } from './auth.ts'
import { db } from './db.ts'
import { errorHandler, notFound } from './http.ts'
import { authRouter } from './routes/auth.ts'
import { devRouter } from './routes/dev.ts'
import { plansRouter } from './routes/plans.ts'
import { profilesRouter } from './routes/profiles.ts'
import { progressRouter } from './routes/progress.ts'
import { profileSessionsRouter, sessionsRouter } from './routes/sessions.ts'
import { streamRouter } from './routes/stream.ts'

export interface AppOptions {
  /** Mount /api/dev (seeding). Defaults to true outside production. */
  allowDevRoutes?: boolean
  /** Allowed browser origins. Defaults to reflecting any origin (fine behind the Vite proxy). */
  corsOrigins?: string[]
}

/** Builds the Express app. Connecting the database is the caller's job (see db.ts and test/setup.ts). */
export function createApp(opts: AppOptions = {}): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: opts.corsOrigins && opts.corsOrigins.length ? opts.corsOrigins : true }))
  app.use(express.json({ limit: '2mb' }))

  // Open routes
  app.get('/api/health', async (_req, res) => {
    let state: 'connected' | 'disconnected' = 'disconnected'
    try {
      await db().query('select 1')
      state = 'connected'
    } catch {
      state = 'disconnected'
    }
    res.json({ ok: true, db: state, uptime: process.uptime() })
  })
  app.use('/api/auth', authRouter)

  // Everything below needs a signed-in user or the CV module's API key
  app.use('/api/profiles', authenticate, profilesRouter)
  app.use('/api/profiles', plansRouter)
  app.use('/api/profiles', progressRouter)
  app.use('/api/profiles', profileSessionsRouter)
  app.use('/api/profiles', streamRouter)
  app.use('/api/sessions', authenticate, sessionsRouter)
  if (opts.allowDevRoutes ?? process.env.NODE_ENV !== 'production') app.use('/api/dev', authenticate, devRouter)

  app.use('/api', notFound)
  app.use(errorHandler)
  return app
}
