import cors from 'cors'
import express, { type Express, type RequestHandler } from 'express'
import mongoose from 'mongoose'
import { authenticate } from './auth.ts'
import { errorHandler, notFound } from './http.ts'
import { authRouter } from './routes/auth.ts'
import { devRouter } from './routes/dev.ts'
import { plansRouter } from './routes/plans.ts'
import { profilesRouter } from './routes/profiles.ts'
import { progressRouter } from './routes/progress.ts'
import { profileSessionsRouter, sessionsRouter } from './routes/sessions.ts'

export interface AppOptions {
  /** Mount /api/dev (seeding). Defaults to true outside production. */
  allowDevRoutes?: boolean
  /** Allowed browser origins. Defaults to reflecting any origin (fine behind the Vite proxy). */
  corsOrigins?: string[]
  /** Reports whether MongoDB is connected. Defaults to Mongoose's connection state; injectable for tests. */
  isDbConnected?: () => boolean
}

const mongooseConnected = () => mongoose.connection.readyState === 1

/**
 * Data routes answer 503 at once while the database is unreachable, instead of letting Mongoose
 * buffer the query until its server-selection timeout and failing with a 500 ten seconds later.
 */
function requireDb(isConnected: () => boolean): RequestHandler {
  return (_req, res, next) => {
    if (isConnected()) {
      next()
      return
    }
    res.status(503).json({ error: 'Database unavailable', detail: 'The API is not connected to MongoDB; it retries every 10 seconds.' })
  }
}

/** Builds the Express app. Connecting to MongoDB is the caller's job (see db.ts and test/setup.ts). */
export function createApp(opts: AppOptions = {}): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: opts.corsOrigins && opts.corsOrigins.length ? opts.corsOrigins : true }))
  app.use(express.json({ limit: '2mb' }))

  const isConnected = opts.isDbConnected ?? mongooseConnected

  // Open routes
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: isConnected() ? 'connected' : 'disconnected', uptime: process.uptime() })
  })
  app.use('/api', requireDb(isConnected))
  app.use('/api/auth', authRouter)

  // Everything below needs a signed-in user or the CV module's API key
  app.use('/api/profiles', authenticate, profilesRouter)
  app.use('/api/profiles', plansRouter)
  app.use('/api/profiles', progressRouter)
  app.use('/api/profiles', profileSessionsRouter)
  app.use('/api/sessions', authenticate, sessionsRouter)
  if (opts.allowDevRoutes ?? process.env.NODE_ENV !== 'production') app.use('/api/dev', authenticate, devRouter)

  app.use('/api', notFound)
  app.use(errorHandler)
  return app
}
