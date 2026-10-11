import { bodyGrowth, type BodyDto, type GrowthSession } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { Session } from '../models/Session.ts'
import { requireProfile } from '../services/profiles.ts'

/** Mounted at /api/profiles (behind `authenticate`) */
export const bodyRouter = Router()

/**
 * The body the profile's training has grown (growth.ts): each muscle group's level, the sets that
 * worked it, and the levels week by week. Members and the camera app's key, like progress.
 */
bodyRouter.get('/:id/body', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  // Only the fields the model reads: a profile's whole history is loaded, so keep each session small.
  const sessions = await Session.find({ profileId: profile._id }).select({ exercise: 1, startedAt: 1, sets: 1, loadKg: 1 }).lean<GrowthSession[]>()
  const body: BodyDto = { profileId: profile._id.toString(), figure: profile.figure ?? null, ...bodyGrowth(sessions, { now: Date.now() }) }
  res.json(body)
})
