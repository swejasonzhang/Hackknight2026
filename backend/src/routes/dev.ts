import { SeedRequestSchema } from '@arc/dependencies'
import { Router } from 'express'
import { requireUser } from '../auth.ts'
import { validate } from '../http.ts'
import { seedDemoData } from '../services/seed.ts'

/**
 * Mounted at /api/dev (behind `authenticate`) in every environment. The demo seed only ever
 * writes to the signed-in caller's own account; the camera app's key is refused (403).
 */
export const devRouter = Router()

devRouter.post('/seed', async (req, res) => {
  const input = validate(SeedRequestSchema, req.body)
  const result = await seedDemoData(requireUser(req), { tzOffsetMinutes: input?.tzOffsetMinutes })
  res.status(result.created ? 201 : 200).json(result)
})
