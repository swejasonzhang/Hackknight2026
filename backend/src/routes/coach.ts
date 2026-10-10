import { catalogByArea, OnboardingInputSchema, SetFeedbackInputSchema, type CoachStatus, type OnboardingReply } from '@arc/dependencies'
import { Router, type RequestHandler } from 'express'
import mongoose from 'mongoose'
import { requireUser } from '../auth.ts'
import { HttpError, toObjectId, validate } from '../http.ts'
import { CoachMessage, toCoachMessageDto } from '../models/CoachMessage.ts'
import { Plan, toPlanDto } from '../models/Plan.ts'
import { Program, toProgramDto } from '../models/Program.ts'
import { Profile, type ProfileShape } from '../models/Profile.ts'
import { Session, toSessionDto, type SessionShape } from '../models/Session.ts'
import { User } from '../models/User.ts'
import { onboardingTurn, planFromProgram, sessionSummary, setFeedback } from '../services/arc.ts'
import { geminiConfigured } from '../services/gemini.ts'
import { requireProfile } from '../services/profiles.ts'
import { speak, voiceConfigured } from '../services/voice.ts'

/**
 * Mounted at /api/coach (behind `authenticate`), for signed-in members only: Arc's onboarding
 * chat, the read after each set and after a session (Gemini, or Arc's templates without it), and
 * Arc's voice for any of those lines (ElevenLabs). Every line is stored as a CoachMessage.
 */
export const coachRouter = Router()

/** Paid APIs sit behind these routes: a member gets a few dozen calls a minute, which no real use needs more of. */
const recent = new Map<string, number[]>()
const limit: RequestHandler = (req, _res, next) => {
  const key = requireUser(req).toString()
  const max = Number(process.env.COACH_MAX_PER_MINUTE) || 40
  const now = Date.now()
  const calls = (recent.get(key) ?? []).filter((t) => now - t < 60_000)
  if (calls.length >= max) {
    next(new HttpError(429, 'Arc needs a breather: too many requests this minute.'))
    return
  }
  calls.push(now)
  recent.set(key, calls)
  next()
}

async function memberName(userId: mongoose.Types.ObjectId): Promise<string> {
  const user = await User.findById(userId).lean<{ name: string }>()
  return user?.name ?? 'there'
}

coachRouter.get('/status', (req, res) => {
  requireUser(req)
  const status: CoachStatus = { gemini: geminiConfigured(), voice: voiceConfigured() }
  res.json(status)
})

coachRouter.post('/onboarding', limit, async (req, res) => {
  const userId = requireUser(req)
  const input = validate(OnboardingInputSchema, req.body)
  const existing = input.profileId ? await requireProfile(input.profileId, { kind: 'user', userId }) : null
  const name = await memberName(userId)
  const turn = await onboardingTurn(input.messages, name)
  const now = Date.now()

  const last = input.messages.at(-1)
  if (last?.role === 'user') await CoachMessage.create({ ownerId: userId, profileId: existing?._id, kind: 'onboarding', role: 'user', text: last.text, offline: turn.offline, createdAt: now - 1 })
  const arcLine = await CoachMessage.create({ ownerId: userId, profileId: existing?._id, kind: 'onboarding', role: 'arc', text: turn.reply, offline: turn.offline, createdAt: now })

  const reply: OnboardingReply = { reply: turn.reply, messageId: arcLine._id.toString(), done: turn.done, offline: turn.offline }
  if (turn.topic) reply.topic = turn.topic
  // Where to start: the page shows every movement Arc can track, the same catalog Gemini was given.
  if (turn.topic === 'focus') reply.choices = catalogByArea()
  if (turn.done && turn.intake && turn.program) {
    // Arc saves what it learned: on the profile it was given, or on a new one named after the member.
    const profile: ProfileShape = existing
      ? (await Profile.findByIdAndUpdate(existing._id, { $set: { intake: turn.intake, notes: turn.intake.goals.slice(0, 500) } }, { new: true }).lean<ProfileShape>())!
      : (await Profile.create({ ownerId: userId, name, notes: turn.intake.goals.slice(0, 500), intake: turn.intake, createdAt: now })).toObject()
    // The week, and the active plan Record starts from: the week's first movement.
    await Program.updateMany({ profileId: profile._id, active: true }, { $set: { active: false } })
    const program = await Program.create({ ...turn.program, source: turn.programSource ?? 'arc', profileId: profile._id, active: true, createdAt: now })
    await Plan.updateMany({ profileId: profile._id, active: true }, { $set: { active: false } })
    const plan = await Plan.create({ ...planFromProgram(turn.program), profileId: profile._id, active: true, createdAt: now })
    await CoachMessage.updateMany({ ownerId: userId, kind: 'onboarding', profileId: { $exists: false } }, { $set: { profileId: profile._id } })
    Object.assign(reply, { intake: turn.intake, profileId: profile._id.toString(), plan: toPlanDto(plan), program: toProgramDto(program.toObject()) })
  }
  res.json(reply)
})

coachRouter.post('/sets', limit, async (req, res) => {
  const userId = requireUser(req)
  const input = validate(SetFeedbackInputSchema, req.body)
  const profile = await requireProfile(input.profileId, { kind: 'user', userId })
  const name = await memberName(userId)
  const { text, offline } = await setFeedback({ name, exercise: input.exercise, side: input.side, plan: input.plan, setNumber: input.setNumber, reps: input.reps, intake: profile.intake })
  const message = await CoachMessage.create({ ownerId: userId, profileId: profile._id, kind: 'set', role: 'arc', text, offline, createdAt: Date.now() })
  res.json(toCoachMessageDto(message))
})

coachRouter.post('/sessions/:id/summary', limit, async (req, res) => {
  const userId = requireUser(req)
  const oid = toObjectId(String(req.params.id))
  const session = oid ? await Session.findById(oid).lean<SessionShape>() : null
  if (!session) throw new HttpError(404, 'Session not found')
  const profile = await requireProfile(session.profileId.toString(), { kind: 'user', userId })

  // Once per session: a second call returns the stored read.
  if (session.coachSummary) {
    const stored = await CoachMessage.findById(session.coachSummary.messageId).lean()
    if (stored) {
      res.json(toCoachMessageDto(stored))
      return
    }
  }
  const history = await Session.find({ profileId: session.profileId, exercise: session.exercise, startedAt: { $lt: session.startedAt } })
    .sort({ startedAt: 1 })
    .lean<SessionShape[]>()
  const name = await memberName(userId)
  const { text, offline } = await sessionSummary({ name, session: toSessionDto(session), history: history.map(toSessionDto), intake: profile.intake })
  const now = Date.now()
  const message = await CoachMessage.create({ ownerId: userId, profileId: profile._id, sessionId: session._id, kind: 'session', role: 'arc', text, offline, createdAt: now })
  await Session.updateOne({ _id: session._id }, { $set: { coachSummary: { text, messageId: message._id.toString(), createdAt: now, offline } } })
  res.json(toCoachMessageDto(message))
})

coachRouter.get('/messages/:id/audio', async (req, res) => {
  const userId = requireUser(req)
  const oid = toObjectId(req.params.id)
  const message = oid ? await CoachMessage.findOne({ _id: oid, ownerId: userId, role: 'arc' }).lean() : null
  if (!message) throw new HttpError(404, 'Message not found')
  if (!voiceConfigured()) throw new HttpError(503, "Arc's voice is not configured")
  let audio: ArrayBuffer
  try {
    audio = await speak(message.text)
  } catch {
    throw new HttpError(502, "Arc's voice is unavailable right now")
  }
  res.set('cache-control', 'private, max-age=3600').type('audio/mpeg').send(Buffer.from(audio))
})
