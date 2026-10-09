import { Router } from 'express'
import { seedDemoData } from '../services/seed.ts'

/** Mounted at /api/dev. Never mounted in production. */
export const devRouter = Router()

devRouter.post('/seed', async (_req, res) => {
  const result = await seedDemoData()
  res.status(result.created ? 201 : 200).json(result)
})
