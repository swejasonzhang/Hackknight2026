import { CreateSessionSchema, ExerciseIdSchema, estimateFatigue, summarizeSets } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { db } from '../db.ts'
import { publishSession } from '../events.ts'
import { HttpError, validate } from '../http.ts'
import { requireProfile } from '../store/profiles.ts'
import { findSession, listSessions, storeSession } from '../store/sessions.ts'

/** Mounted at /api/sessions (behind `authenticate`). POST is how the CV module stores a session. */
export const sessionsRouter = Router()

sessionsRouter.post('/', async (req, res) => {
  const input = validate(CreateSessionSchema, req.body)
  const profile = await requireProfile(input.profileId, principalOf(req))
  // Never trust client-side derived numbers: recompute fatigue per set and the summary.
  const sets = input.sets.map((set) => ({ ...set, fatigue: estimateFatigue(set.reps) }))
  const session = await storeSession(db(), {
    profileId: profile.id,
    exercise: input.exercise,
    side: input.side,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    plan: input.plan,
    sets,
    summary: summarizeSets(sets),
    demo: input.demo ?? false,
  })
  res.status(201).json(session)
  publishSession(session)
})

sessionsRouter.get('/:id', async (req, res) => {
  const session = await findSession(db(), req.params.id)
  if (!session) throw new HttpError(404, 'Session not found')
  await requireProfile(session.profileId, principalOf(req)) // 404 unless the caller may see this profile
  res.json(session)
})

/** Mounted at /api/profiles (behind `authenticate`) */
export const profileSessionsRouter = Router()

profileSessionsRouter.get('/:id/sessions', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const exercise = req.query.exercise !== undefined ? validate(ExerciseIdSchema, req.query.exercise) : undefined
  res.json(await listSessions(db(), profile.id, exercise))
})
