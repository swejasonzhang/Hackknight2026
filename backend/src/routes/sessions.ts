import { CreateSessionSchema, ExerciseIdSchema, estimateFatigue, summarizeSets } from '@ptg/dependencies'
import { Router } from 'express'
import { HttpError, toObjectId, validate } from '../http.ts'
import { Session, toSessionDto, type SessionShape } from '../models/Session.ts'
import { requireProfile } from '../services/profiles.ts'

/** Mounted at /api */
export const sessionsRouter = Router()

sessionsRouter.post('/sessions', async (req, res) => {
  const input = validate(CreateSessionSchema, req.body)
  const profile = await requireProfile(input.profileId)
  // Never trust client-side derived numbers: recompute fatigue per set and the summary.
  const sets = input.sets.map((set) => ({ ...set, fatigue: estimateFatigue(set.reps) }))
  const session = await Session.create({
    profileId: profile._id,
    exercise: input.exercise,
    side: input.side,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    plan: input.plan,
    sets,
    summary: summarizeSets(sets),
    demo: input.demo ?? false,
  })
  res.status(201).json(toSessionDto(session))
})

sessionsRouter.get('/profiles/:id/sessions', async (req, res) => {
  const profile = await requireProfile(req.params.id)
  const filter: Record<string, unknown> = { profileId: profile._id }
  if (req.query.exercise !== undefined) filter.exercise = validate(ExerciseIdSchema, req.query.exercise)
  const sessions = await Session.find(filter).sort({ startedAt: -1, _id: -1 }).lean<SessionShape[]>()
  res.json(sessions.map(toSessionDto))
})

sessionsRouter.get('/sessions/:id', async (req, res) => {
  const oid = toObjectId(req.params.id)
  const session = oid ? await Session.findById(oid).lean<SessionShape>() : null
  if (!session) throw new HttpError(404, 'Session not found')
  res.json(toSessionDto(session))
})
