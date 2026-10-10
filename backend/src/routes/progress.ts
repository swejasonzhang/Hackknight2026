import { ExerciseIdSchema } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { db } from '../db.ts'
import { validate } from '../http.ts'
import { buildProgress } from '../services/progress.ts'
import { activePlan } from '../store/plans.ts'
import { requireProfile } from '../store/profiles.ts'
import { sessionsForProgress } from '../store/sessions.ts'

/** Mounted at /api/profiles (behind `authenticate`) */
export const progressRouter = Router()

progressRouter.get('/:id/progress', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const exercise = validate(ExerciseIdSchema, req.query.exercise)
  const [sessions, plan] = await Promise.all([sessionsForProgress(db(), profile.id, exercise), activePlan(db(), profile.id, exercise)])
  res.json(buildProgress(profile.id, exercise, sessions, plan?.target_deg ?? null))
})
