import { CreateSessionSchema, ExerciseIdSchema, estimateFatigue, summarizeSets, type CreateSessionInput } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { HttpError, toObjectId, validate } from '../http.ts'
import { Session, toSessionDto, type SessionShape } from '../models/Session.ts'
import { requireProfile } from '../services/profiles.ts'

/**
 * Mounted at /api/sessions (behind `authenticate`). The browser saves a recording here set by set
 * (POST, then PUT), the camera app the whole session at once (POST with its key).
 */
export const sessionsRouter = Router()

/** What a session body stores. Never trust client-side derived numbers: fatigue per set and the summary are recomputed. */
function recordOf(input: CreateSessionInput) {
  const sets = input.sets.map((set) => ({ ...set, fatigue: estimateFatigue(set.reps) }))
  return {
    exercise: input.exercise,
    side: input.side,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    plan: input.plan,
    sets,
    summary: summarizeSets(sets),
    complete: input.complete ?? true,
    ...(input.events?.length ? { events: input.events } : {}),
    ...(input.loadKg != null ? { loadKg: input.loadKg } : {}),
  }
}

sessionsRouter.post('/', async (req, res) => {
  const input = validate(CreateSessionSchema, req.body)
  const profile = await requireProfile(input.profileId, principalOf(req))
  const session = await Session.create({ ...recordOf(input), profileId: profile._id, demo: input.demo ?? false })
  res.status(201).json(toSessionDto(session))
})

/**
 * The browser saves a recording as it goes: created after the first set (`complete: false`),
 * then replaced with every set so far after each later one, and marked complete at the end. A
 * finished session is final (409); the body must name the session's own profile (400).
 */
sessionsRouter.put('/:id', async (req, res) => {
  const input = validate(CreateSessionSchema, req.body)
  const oid = toObjectId(req.params.id)
  const existing = oid ? await Session.findById(oid).lean<SessionShape>() : null
  if (!existing) throw new HttpError(404, 'Session not found')
  await requireProfile(existing.profileId.toString(), principalOf(req)) // 404 unless the caller may see it
  if (input.profileId !== existing.profileId.toString()) throw new HttpError(400, 'A session stays with its profile')
  if (existing.complete !== false) throw new HttpError(409, 'This session is finished')
  const session = await Session.findByIdAndUpdate(existing._id, { $set: recordOf(input) }, { new: true, runValidators: true }).lean<SessionShape>()
  res.json(toSessionDto(session!))
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
