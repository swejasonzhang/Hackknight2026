import cors from 'cors'
import express, { type Express } from 'express'
import mongoose from 'mongoose'
import { errorHandler, notFound } from './http.ts'
import { devRouter } from './routes/dev.ts'
import { profilesRouter } from './routes/profiles.ts'
import { plansRouter } from './routes/plans.ts'
import { progressRouter } from './routes/progress.ts'
import { sessionsRouter } from './routes/sessions.ts'

export interface AppOptions {
  /** Mount /api/dev (seeding). Defaults to true outside production. */
  allowDevRoutes?: boolean
  /** Allowed browser origins. Defaults to reflecting any origin (fine behind the Vite proxy). */
  corsOrigins?: string[]
}

/** Builds the Express app. Connecting to MongoDB is the caller's job (see db.ts and test/setup.ts). */
export function createApp(opts: AppOptions = {}): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: opts.corsOrigins && opts.corsOrigins.length ? opts.corsOrigins : true }))
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', uptime: process.uptime() })
  })

  app.use('/api/profiles', profilesRouter)
  app.use('/api/profiles', plansRouter)
  app.use('/api/profiles', progressRouter)
  app.use('/api', sessionsRouter)
  if (opts.allowDevRoutes ?? process.env.NODE_ENV !== 'production') app.use('/api/dev', devRouter)

  app.use('/api', notFound)
  app.use(errorHandler)
  return app
}
