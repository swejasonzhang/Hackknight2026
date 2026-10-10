import { leaderboard, LEADERBOARD_WINDOWS, LeaderboardWindowSchema } from '@arc/dependencies'
import { Router } from 'express'
import { requireUser } from '../auth.ts'
import { validate } from '../http.ts'
import { Profile, type ProfileShape } from '../models/Profile.ts'
import { Session, toSessionDto, type SessionShape } from '../models/Session.ts'

/** Mounted at /api/leaderboard (behind `authenticate`). */
export const leaderboardRouter = Router()

/**
 * The household leaderboard (ADR-0027): the account's own profiles ranked on the window's
 * training (`?window=week|month|all`, a week by default). Members only, and only their own
 * profiles: nobody is compared with another account.
 */
leaderboardRouter.get('/', async (req, res) => {
  const ownerId = requireUser(req)
  const window = validate(LeaderboardWindowSchema, req.query.window ?? 'week')
  const now = Date.now()
  const days = LEADERBOARD_WINDOWS[window]
  const profiles = await Profile.find({ ownerId }).sort({ createdAt: 1, _id: 1 }).lean<ProfileShape[]>()
  const sessions = await Session.find({ profileId: { $in: profiles.map((p) => p._id) }, ...(days ? { startedAt: { $gte: now - days * 86_400_000 } } : {}) })
    .select({ coachSummary: 0, events: 0 })
    .lean<SessionShape[]>()
  res.json(leaderboard(profiles.map((p) => ({ id: p._id.toString(), name: p.name })), sessions.map(toSessionDto), { window, now }))
})
