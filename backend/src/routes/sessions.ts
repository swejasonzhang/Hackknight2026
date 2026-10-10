import { CreateSessionSchema, ExerciseIdSchema, estimateFatigue, summarizeSets } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { HttpError, toObjectId, validate } from '../http.ts'
import { Session, toSessionDto, type SessionShape } from '../models/Session.ts'
import { requireProfile } from '../services/profiles.ts'

/** Mounted at /api/sessions (behind `authenticate`). POST is how the CV module stores a session. */
export const sessionsRouter = Router()

sessionsRouter.post('/', async (req, res) => {
  const input = validate(CreateSessionSchema, req.body)
  const profile = await requireProfile(input.profileId, principalOf(req))
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
    ...(input.events?.length ? { events: input.events } : {}),
  })
  res.status(201).json(toSessionDto(session))
})

sessionsRouter.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id)
  const session = oid ? await Session.findById(oid).lean<SessionShape>() : null
  if (!session) throw new HttpError(404, 'Session not found')
  await requireProfile(session.profileId.toString(), principalOf(req)) // 404 unless the caller may see this profile
  res.json(toSessionDto(session))
})

/** Mounted at /api/profiles (behind `authenticate`) */
export const profileSessionsRouter = Router()

profileSessionsRouter.get('/:id/sessions', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const filter: Record<string, unknown> = { profileId: profile._id }
  if (req.query.exercise !== undefined) filter.exercise = validate(ExerciseIdSchema, req.query.exercise)
  const sessions = await Session.find(filter).sort({ startedAt: -1, _id: -1 }).lean<SessionShape[]>()
  res.json(sessions.map(toSessionDto))
})
