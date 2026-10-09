import { ExerciseIdSchema } from '@ptg/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { validate } from '../http.ts'
import { Plan, type PlanShape } from '../models/Plan.ts'
import { Session, toSessionDto, type SessionShape } from '../models/Session.ts'
import { requireProfile } from '../services/profiles.ts'
import { buildProgress } from '../services/progress.ts'

/** Mounted at /api/profiles (behind `authenticate`) */
export const progressRouter = Router()

progressRouter.get('/:id/progress', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const exercise = validate(ExerciseIdSchema, req.query.exercise)
  const [sessions, plan] = await Promise.all([
    Session.find({ profileId: profile._id, exercise }).lean<SessionShape[]>(),
    Plan.findOne({ profileId: profile._id, exercise, active: true }).lean<PlanShape>(),
  ])
  res.json(buildProgress(profile._id.toString(), exercise, sessions.map(toSessionDto), plan?.targetDeg ?? null))
})
