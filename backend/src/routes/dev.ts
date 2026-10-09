import { Router } from 'express'
import { requireUser } from '../auth.ts'
import { seedDemoData } from '../services/seed.ts'

/** Mounted at /api/dev (behind `authenticate`). Never mounted in production. */
export const devRouter = Router()

devRouter.post('/seed', async (req, res) => {
  const result = await seedDemoData(requireUser(req))
  res.status(result.created ? 201 : 200).json(result)
})
