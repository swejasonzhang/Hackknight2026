import { CHALLENGES, challengeEnds, challengeWeek, describeWeek, EXERCISES, mondayFirst, phaseAt, StartChallengeSchema, type Challenge, type ProgramInput } from '@arc/dependencies'
import { Router, type RequestHandler } from 'express'
import type { Types } from 'mongoose'
import { principalOf } from '../auth.ts'
import { HttpError, validate } from '../http.ts'
import { ChallengeRun, toChallengeRunDto, type ChallengeRunShape } from '../models/ChallengeRun.ts'
import { Plan } from '../models/Plan.ts'
import type { ProfileShape } from '../models/Profile.ts'
import { Program } from '../models/Program.ts'
import { planFromProgram } from '../services/arc.ts'
import { requireProfile } from '../services/profiles.ts'

/**
 * Mounted at /api/profiles (behind `authenticate`), ahead of plansRouter, so that a read of the
 * week brings the challenge in progress up to date first (see `catchUp`).
 */
export const challengesRouter = Router()

const DAY = 86_400_000

/**
 * The challenge a run is at, or undefined when Arc no longer has it. Runs are read lean, past the
 * model's enum, and a challenge renamed or dropped since must not leave its runs impossible to
 * read, leave or replace.
 */
function challengeOf(run: ChallengeRunShape): Challenge | undefined {
  return Object.hasOwn(CHALLENGES, run.challengeId) ? CHALLENGES[run.challengeId] : undefined
}

/**
 * A phase's week as the profile's: Monday first, each one-sided movement on the side the member
 * gave Arc (a challenge is written for the right), and a summary that says where in the
 * challenge it falls. It names the weeks the phase runs rather than the week it began, because
 * the summary stands until the next phase replaces it.
 */
function phaseWeek(profile: ProfileShape, challenge: Challenge, phase: number): ProgramInput {
  const { fromWeek, name, days } = challenge.phases[phase]!
  const toWeek = (challenge.phases[phase + 1]?.fromWeek ?? challenge.weeks + 1) - 1
  const side = profile.intake?.side
  const sorted = [...days]
    .sort((a, b) => mondayFirst(a.weekday, b.weekday))
    .map((d) => ({ ...d, items: d.items.map((item) => (side && EXERCISES[item.exercise].sided ? { ...item, side } : item)) }))
  const weeks = fromWeek === toWeek ? `week ${fromWeek}` : `weeks ${fromWeek}–${toWeek}`
  const summary = `${challenge.name}, ${weeks} of ${challenge.weeks}: ${name}. ${describeWeek(sorted, '')}`
  return { summary: summary.length <= 800 ? summary : `${summary.slice(0, 797)}…`, days: sorted }
}

/**
 * Makes `week` the profile's week the way PUT /:id/program does: the last week and plan are kept
 * in history, and Record's plan follows the week's first movement.
 */
async function setWeek(profileId: Types.ObjectId, week: ProgramInput, now: number) {
  await Program.updateMany({ profileId, active: true }, { $set: { active: false } })
  await Program.create({ ...week, source: 'challenge', profileId, active: true, createdAt: now })
  await Plan.updateMany({ profileId, active: true }, { $set: { active: false } })
  await Plan.create({ ...planFromProgram(week), profileId, active: true, createdAt: now })
}

/** Each profile's last piece of challenge work, which the next one waits for. */
const turns = new Map<string, Promise<unknown>>()

/**
 * Runs `work` once the profile's challenge work before it has finished, so a start, a leave and a
 * new phase's week happen one at a time. Otherwise a look that moves the challenge to its next
 * phase could write that phase's week over the one a start had just written, and a read of the
 * week could find none while it is being replaced. The API is one Node process (render.yaml), so
 * a promise chain per profile is enough; the run's conditional updates still stop it changing
 * twice if more ever share the database.
 */
function inTurn<T>(profileId: Types.ObjectId, work: () => Promise<T>): Promise<T> {
  const key = profileId.toString()
  const result = (turns.get(key) ?? Promise.resolve()).then(() => work())
  // The next in line waits for this one whether it worked or failed.
  const settled = result.catch(() => undefined)
  turns.set(key, settled)
  // A profile nothing is waiting on is forgotten, so the map only holds profiles in use.
  void settled.then(() => {
    if (turns.get(key) === settled) turns.delete(key)
  })
  return result
}

/**
 * Ends the profile's run in progress, if there is one: left as of now, or done at its finish when
 * its last day was already over (nobody had opened the challenge since). A run at a challenge Arc
 * no longer has is left: it has no finish to have reached. How many runs it ended.
 */
async function endActiveRun(profileId: Types.ObjectId, now: number): Promise<number> {
  const active = await ChallengeRun.find({ profileId, status: 'active' }).lean<ChallengeRunShape[]>()
  for (const run of active) {
    const challenge = challengeOf(run)
    const ends = challenge ? challengeEnds(run, challenge) : Infinity
    await ChallengeRun.updateOne({ _id: run._id, status: 'active' }, { $set: now >= ends ? { status: 'done', endedAt: ends } : { status: 'left', endedAt: now } })
  }
  return active.length
}

/**
 * What bringing a run in progress up to `now` changes, if anything: it is done once its last day
 * is over, on a new phase once that phase has begun (from any phase before it, so a member back
 * after weeks away lands on the phase they are in), and left when Arc no longer has its challenge,
 * as there is no week to go on with.
 */
function dueChange(run: ChallengeRunShape, challenge: Challenge | undefined, now: number): Partial<ChallengeRunShape> | null {
  if (!challenge) return { status: 'left', endedAt: now }
  const ends = challengeEnds(run, challenge)
  if (now >= ends) return { status: 'done', endedAt: ends }
  const phase = phaseAt(challenge, challengeWeek(run, challenge, now))
  return phase > run.phase ? { phase } : null
}

/**
 * A run in progress, brought up to `now` (see `dueChange`); on a new phase, that phase's week
 * replaces the member's, and when it is done its last week stays the member's week. Callers take
 * the profile's turn.
 */
async function bringUpToDate(profile: ProfileShape, run: ChallengeRunShape, now: number): Promise<ChallengeRunShape> {
  const challenge = challengeOf(run)
  const change = dueChange(run, challenge, now)
  if (!change) return run
  const updated = await ChallengeRun.findOneAndUpdate({ _id: run._id, status: 'active', phase: run.phase }, { $set: change }, { returnDocument: 'after' }).lean<ChallengeRunShape>()
  // Changed since it was read by something outside the profile's turns (another process sharing the database): answer with what that made.
  if (!updated) return (await ChallengeRun.findById(run._id).lean<ChallengeRunShape>()) ?? run
  if (challenge && change.phase != null) await setWeek(profile._id, phaseWeek(profile, challenge, change.phase), now)
  return updated
}

/**
 * Before the week is read (the dashboard, the plan page, Record, a day's workout, the camera
 * app's key), the challenge in progress is brought up to date, so a member who goes straight to
 * their week when a new phase begins gets that phase's week. Taking the profile's turn, a read
 * that comes while a new week is being written waits for it instead of finding the old week or
 * none. Then plansRouter answers.
 */
const catchUp: RequestHandler<{ id: string }> = async (req, _res, next) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  await inTurn(profile._id, async () => {
    const run = await ChallengeRun.findOne({ profileId: profile._id, status: 'active' }).sort({ createdAt: -1, _id: -1 }).lean<ChallengeRunShape>()
    if (run) await bringUpToDate(profile, run, Date.now())
  })
  next()
}

challengesRouter.get('/:id/program', catchUp)
challengesRouter.get('/:id/plan', catchUp)

/**
 * The profile's challenge: its latest run, unless the member left it or Arc no longer has its
 * challenge (404). Members and the camera app's key. Latest by when it was created rather than
 * `startedAt`: a run started after a change of time zone can begin on a day that starts before
 * the last one's.
 */
challengesRouter.get('/:id/challenge', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const run = await inTurn(profile._id, async () => {
    const latest = await ChallengeRun.findOne({ profileId: profile._id }).sort({ createdAt: -1, _id: -1 }).lean<ChallengeRunShape>()
    return latest?.status === 'active' ? bringUpToDate(profile, latest, Date.now()) : latest
  })
  if (!run || run.status === 'left' || !challengeOf(run)) throw new HttpError(404, 'No challenge')
  res.json(toChallengeRunDto(run))
})

/**
 * Starts a challenge: the run in progress, if any, ends, and the challenge's first phase becomes
 * the profile's week. It starts at the beginning of the member's day, so its weeks turn over at
 * their midnight. Members only: the camera app reads challenges but never changes the week.
 */
challengesRouter.post('/:id/challenge', async (req, res) => {
  const principal = principalOf(req)
  if (principal.kind !== 'user') throw new HttpError(403, 'Only the member can start a challenge')
  const { challengeId, tzOffsetMinutes } = validate(StartChallengeSchema, req.body)
  const profile = await requireProfile(req.params.id, principal)
  const offset = (tzOffsetMinutes ?? 0) * 60_000
  const run = await inTurn(profile._id, async () => {
    const now = Date.now()
    await endActiveRun(profile._id, now)
    await setWeek(profile._id, phaseWeek(profile, CHALLENGES[challengeId], 0), now)
    return ChallengeRun.create({ profileId: profile._id, challengeId, startedAt: Math.floor((now - offset) / DAY) * DAY + offset, status: 'active', phase: 0, createdAt: now })
  })
  res.status(201).json(toChallengeRunDto(run.toObject()))
})

/** Leaves the challenge in progress (members only). The week stays as it is until the member changes it. */
challengesRouter.delete('/:id/challenge', async (req, res) => {
  const principal = principalOf(req)
  if (principal.kind !== 'user') throw new HttpError(403, 'Only the member can leave a challenge')
  const profile = await requireProfile(req.params.id, principal)
  if (!(await inTurn(profile._id, () => endActiveRun(profile._id, Date.now())))) throw new HttpError(404, 'No challenge in progress')
  res.status(204).end()
})
