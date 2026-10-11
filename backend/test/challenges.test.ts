import { CHALLENGES, describeWeek, EXERCISES, type ChallengeRunDto, type ProgramDay } from '@arc/dependencies'
import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'
import { ChallengeRun } from '../src/models/ChallengeRun.ts'
import { Plan } from '../src/models/Plan.ts'
import { Profile } from '../src/models/Profile.ts'
import { Program } from '../src/models/Program.ts'
import { anon, createProfile, service, signup } from './helpers.ts'

const DAY = 86_400_000
const WEEK = 7 * DAY
const challengeOf = (profileId: string) => `/api/profiles/${profileId}/challenge`
/** A week's movements as [exercise, side], day by day. */
const sides = (days: ProgramDay[]) => days.flatMap((d) => d.items.map((i) => [i.exercise, i.side]))
/** A week without its sides, to hold up against a challenge's as written. */
const withoutSides = (days: ProgramDay[]) => days.map((d) => ({ ...d, items: d.items.map(({ side: _side, ...item }) => item) }))
/** The member's own one-day week, to see a challenge's week replace it. */
const legs = { weekday: 1, title: 'Legs', items: [{ exercise: 'squat', side: 'right', sets: 3, reps: 10, restSeconds: 60, targetDeg: EXERCISES.squat.targetDeg }] }
/** What a member who trains their left side told Arc. */
const leftSided = { goals: 'Bigger arms', focus: 'elbow_flexion', side: 'left', limitations: 'none', experience: 'some', daysPerWeek: 3 }

/** Summer body over the member's own week, started five weeks ago and not opened since: its second phase began this week. */
async function atNewPhase() {
  const c = await signup()
  const profileId = await createProfile(c)
  expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [legs] })).status).toBe(201)
  const startedAt = Date.now() - 5 * WEEK
  const run = await ChallengeRun.create({ profileId, challengeId: 'summer_body', startedAt, status: 'active', phase: 0, createdAt: startedAt })
  return { c, profileId, runId: run._id.toString() }
}

describe('starting a challenge (POST /api/profiles/:id/challenge)', () => {
  it("makes its first phase the member's week, one-sided movements on their side, and returns the run", async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    await Profile.updateOne({ _id: profileId }, { $set: { intake: leftSided } })
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [legs] })).status).toBe(201)

    const before = Date.now()
    const res = await c.post(challengeOf(profileId)).send({ challengeId: 'strong_arms' })
    expect(res.status).toBe(201)
    const run = res.body as ChallengeRunDto
    expect(run).toEqual({ id: expect.any(String), profileId, challengeId: 'strong_arms', startedAt: expect.any(Number), status: 'active', phase: 0 })
    // The start of today in UTC, as no time zone was given.
    expect([Math.floor(before / DAY) * DAY, Math.floor(Date.now() / DAY) * DAY]).toContain(run.startedAt)

    // The first phase's days, Monday first, with every number as the challenge sets it.
    const pump = CHALLENGES.strong_arms.phases[0]!
    const week = (await c.get(`/api/profiles/${profileId}/program`)).body
    expect(week).toMatchObject({ profileId, source: 'challenge', active: true })
    expect(week.days.map((d: ProgramDay) => d.weekday)).toEqual([1, 3, 5])
    expect(withoutSides(week.days)).toEqual(withoutSides(pump.days))
    // Curls, extensions, raises and rows on the left the member gave Arc; presses work both sides and stay as they are.
    expect(sides(week.days)).toEqual([
      ['elbow_flexion', 'left'],
      ['tricep_extension', 'left'],
      ['front_raise', 'left'],
      ['shoulder_press', 'right'],
      ['elbow_flexion', 'left'],
      ['tricep_extension', 'left'],
      ['chest_press', 'right'],
      ['bent_over_row', 'left'],
      ['elbow_flexion', 'left'],
    ])
    // The weeks the phase runs, which stay true until the next phase replaces the week.
    expect(week.summary).toBe(`Strong arms, weeks 1–4 of 8: Pump. ${describeWeek(pump.days, '')}`)
    // The member's own week is kept in history, and Record starts from the challenge week's first movement.
    const history = (await c.get(`/api/profiles/${profileId}/programs`)).body
    expect(history.map((p: { source: string; active: boolean }) => [p.source, p.active])).toEqual([
      ['challenge', true],
      ['member', false],
    ])
    expect((await c.get(`/api/profiles/${profileId}/plan`)).body).toMatchObject({ exercise: 'elbow_flexion', side: 'left', sets: 3, reps: 12, restSeconds: 60, targetDeg: EXERCISES.elbow_flexion.targetDeg })

    expect((await c.get(challengeOf(profileId))).body).toEqual(run)
  })

  it("starts at the beginning of the member's day, by the time zone the browser gives", async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const before = Date.now()
    // New York in summer (UTC−4): its midnight is 04:00 UTC.
    const newYork = (await c.post(challengeOf(profileId)).send({ challengeId: 'first_month', tzOffsetMinutes: 240 })).body as ChallengeRunDto
    expect((newYork.startedAt - 4 * 3_600_000) % DAY).toBe(0)
    expect(newYork.startedAt).toBeGreaterThan(before - DAY)
    expect(newYork.startedAt).toBeLessThanOrEqual(Date.now())
    // Sydney (UTC+10), and UTC itself when the browser gives none.
    const sydney = (await c.post(challengeOf(profileId)).send({ challengeId: 'first_month', tzOffsetMinutes: -600 })).body as ChallengeRunDto
    expect((sydney.startedAt + 10 * 3_600_000) % DAY).toBe(0)
    expect(sydney.startedAt).toBeGreaterThan(before - DAY)
    const utc = (await c.post(challengeOf(profileId)).send({ challengeId: 'first_month' })).body as ChallengeRunDto
    expect(utc.startedAt).toBe(Math.floor(utc.startedAt / DAY) * DAY)
  })

  it('leaves the challenge in progress when another starts, keeping every side as written without an intake', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const first = (await c.post(challengeOf(profileId)).send({ challengeId: 'summer_body' })).body as ChallengeRunDto
    const before = Date.now()
    const second = await c.post(challengeOf(profileId)).send({ challengeId: 'legs_glutes' })
    expect(second.status).toBe(201)

    const left = await ChallengeRun.findById(first.id).lean()
    expect(left).toMatchObject({ status: 'left', phase: 0 })
    expect(left!.endedAt).toBeGreaterThanOrEqual(before)
    expect((await c.get(challengeOf(profileId))).body).toEqual(second.body)

    const week = (await c.get(`/api/profiles/${profileId}/program`)).body
    expect(week.summary).toMatch(/^Legs and glutes, weeks 1–5 of 10: Groove\. /)
    expect(sides(week.days).every(([, side]) => side === 'right')).toBe(true)
    const history = (await c.get(`/api/profiles/${profileId}/programs`)).body
    expect(history.map((p: { summary: string; active: boolean }) => [p.summary.split(',')[0], p.active])).toEqual([
      ['Legs and glutes', true],
      ['Summer body', false],
    ])
  })

  it('counts a run whose last day had already passed as done, not left', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    // The 30-day core (four weeks), started five weeks ago and not opened since.
    const startedAt = Date.now() - 5 * WEEK
    const old = await ChallengeRun.create({ profileId, challengeId: 'core_30', startedAt, status: 'active', phase: 1, createdAt: startedAt })
    expect((await c.post(challengeOf(profileId)).send({ challengeId: 'posture' })).status).toBe(201)
    expect(await ChallengeRun.findById(old._id).lean()).toMatchObject({ status: 'done', phase: 1, endedAt: startedAt + 4 * WEEK })
  })
})

describe("the profile's challenge (GET /api/profiles/:id/challenge)", () => {
  it('is 404 before one starts', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const res = await c.get(challengeOf(profileId))
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('No challenge')
  })

  it("moves on to the next phase when it begins, writing that phase's week once", async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    await Profile.updateOne({ _id: profileId }, { $set: { intake: leftSided } })
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [legs] })).status).toBe(201)
    // Summer body, started five weeks ago: week 6, in the second phase.
    const startedAt = Date.now() - 5 * WEEK
    const run = await ChallengeRun.create({ profileId, challengeId: 'summer_body', startedAt, status: 'active', phase: 0, createdAt: startedAt })

    // Two looks at once (React runs effects twice in development): both see the new phase, and it is written once.
    const [one, two] = await Promise.all([c.get(challengeOf(profileId)), c.get(challengeOf(profileId))])
    expect(one.status).toBe(200)
    expect(one.body).toEqual({ id: run._id.toString(), profileId, challengeId: 'summer_body', startedAt, status: 'active', phase: 1 })
    expect(two.body).toEqual(one.body)

    const volume = CHALLENGES.summer_body.phases[1]!
    const week = (await c.get(`/api/profiles/${profileId}/program`)).body
    expect(week).toMatchObject({ source: 'challenge', active: true })
    expect(withoutSides(week.days)).toEqual(withoutSides(volume.days))
    // The new phase's one-sided movements go on the member's left as well.
    expect(sides(week.days)).toEqual([
      ['chest_press', 'right'],
      ['pec_fly', 'right'],
      ['shoulder_press', 'right'],
      ['shoulder_abduction', 'left'],
      ['elbow_flexion', 'left'],
      ['tricep_extension', 'left'],
      ['crunch', 'right'],
      ['ab_twist', 'right'],
      ['lat_pulldown', 'right'],
      ['bent_over_row', 'left'],
      ['front_raise', 'left'],
      ['shoulder_abduction', 'left'],
      ['squat', 'right'],
      ['lunge', 'left'],
      ['crunch', 'right'],
    ])
    expect(week.summary).toBe(`Summer body, weeks 5–8 of 12: Add volume. ${describeWeek(volume.days, '')}`)
    expect((await c.get(`/api/profiles/${profileId}/plan`)).body).toMatchObject({ exercise: 'chest_press', side: 'right', sets: 4, reps: 10, restSeconds: 90 })
    expect(await Program.countDocuments({ profileId })).toBe(2)
    expect(await Plan.countDocuments({ profileId })).toBe(2)

    // A later look changes nothing.
    expect((await c.get(challengeOf(profileId))).body).toEqual(one.body)
    expect(await Program.countDocuments({ profileId })).toBe(2)
    expect(await Plan.countDocuments({ profileId })).toBe(2)
    expect((await c.get(`/api/profiles/${profileId}/program`)).body.id).toBe(week.id)
  })

  it('goes straight to the phase it is in after weeks unopened, writing that week once', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    await Profile.updateOne({ _id: profileId }, { $set: { intake: leftSided } })
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [legs] })).status).toBe(201)
    // Summer body, started nine weeks ago and not opened since: week 10, in the third phase, two phases on.
    const startedAt = Date.now() - 9 * WEEK
    await ChallengeRun.create({ profileId, challengeId: 'summer_body', startedAt, status: 'active', phase: 0, createdAt: startedAt })

    const res = await c.get(challengeOf(profileId))
    expect(res.body).toMatchObject({ status: 'active', phase: 2 })
    const sharpen = CHALLENGES.summer_body.phases[2]!
    const week = (await c.get(`/api/profiles/${profileId}/program`)).body
    expect(withoutSides(week.days)).toEqual(withoutSides(sharpen.days))
    expect(week.days[1].items[0]).toEqual({ ...sharpen.days[1]!.items[0], exercise: 'elbow_flexion', side: 'left' })
    expect(week.summary).toBe(`Summer body, weeks 9–12 of 12: Sharpen. ${describeWeek(sharpen.days, '')}`)
    expect(await Program.countDocuments({ profileId })).toBe(2)
    expect(await Plan.countDocuments({ profileId })).toBe(2)

    expect((await c.get(challengeOf(profileId))).body).toEqual(res.body)
    expect(await Program.countDocuments({ profileId })).toBe(2)
    expect(await Plan.countDocuments({ profileId })).toBe(2)
  })

  it('is done once its last day is over, its week left as it was', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [legs] })).status).toBe(201)
    const week = (await c.get(`/api/profiles/${profileId}/program`)).body
    // Twelve weeks of summer body, started thirteen weeks ago.
    const startedAt = Date.now() - 13 * WEEK
    await ChallengeRun.create({ profileId, challengeId: 'summer_body', startedAt, status: 'active', phase: 2, createdAt: startedAt })

    const res = await c.get(challengeOf(profileId))
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ challengeId: 'summer_body', status: 'done', phase: 2, startedAt, endedAt: startedAt + 12 * WEEK })
    expect((await c.get(challengeOf(profileId))).body).toEqual(res.body)
    expect((await c.get(`/api/profiles/${profileId}/program`)).body).toEqual(week)
    expect(await Program.countDocuments({ profileId })).toBe(1)
    // Nothing in progress to leave.
    expect((await c.delete(challengeOf(profileId))).status).toBe(404)
  })

  it('answers with the run started last, even when a change of time zone put its first day earlier', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const now = Date.now()
    // Left a minute ago; the next started now, in a time zone whose day began eight hours before the last one's.
    await ChallengeRun.create({ profileId, challengeId: 'summer_body', startedAt: now - 2 * 3_600_000, status: 'left', phase: 0, endedAt: now - 60_000, createdAt: now - 3_600_000 })
    const later = await ChallengeRun.create({ profileId, challengeId: 'v_taper', startedAt: now - 10 * 3_600_000, status: 'active', phase: 0, createdAt: now })
    const res = await c.get(challengeOf(profileId))
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(later._id.toString())
  })

  it('is 404 when the latest run was left, even with a finished one before it', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const now = Date.now()
    // Summer body finished, then the 30-day core started and was left.
    const summer = now - 20 * WEEK
    await ChallengeRun.create({ profileId, challengeId: 'summer_body', startedAt: summer, status: 'done', phase: 2, endedAt: summer + 12 * WEEK, createdAt: summer })
    await ChallengeRun.create({ profileId, challengeId: 'core_30', startedAt: now - 2 * WEEK, status: 'left', phase: 0, endedAt: now - WEEK, createdAt: now - 2 * WEEK })
    const res = await c.get(challengeOf(profileId))
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('No challenge')
  })
})

describe('reading the week (GET /api/profiles/:id/program and /plan)', () => {
  it("moves a challenge on to its new phase first, for the member and the camera app's key, never for another account", async () => {
    const { c, profileId, runId } = await atNewPhase()
    // Another account may not see the profile, so its reads change nothing.
    const stranger = await signup('Grace Hopper')
    expect((await stranger.get(`/api/profiles/${profileId}/plan`)).status).toBe(404)
    expect((await stranger.get(`/api/profiles/${profileId}/program`)).status).toBe(404)
    expect(await ChallengeRun.findById(runId).lean()).toMatchObject({ status: 'active', phase: 0 })

    // The plan, read before anyone opened the challenge, is the new phase's first movement.
    expect((await service().get(`/api/profiles/${profileId}/plan`)).body).toMatchObject({ exercise: 'chest_press', sets: 4, reps: 10, restSeconds: 90 })
    expect(await ChallengeRun.findById(runId).lean()).toMatchObject({ status: 'active', phase: 1 })
    expect((await c.get(`/api/profiles/${profileId}/program`)).body.summary).toMatch(/^Summer body, weeks 5–8 of 12: Add volume\. /)
    expect((await c.get(challengeOf(profileId))).body).toMatchObject({ status: 'active', phase: 1 })
    expect(await Program.countDocuments({ profileId })).toBe(2)
    expect(await Plan.countDocuments({ profileId })).toBe(2)
  })

  it("waits for a new phase's week being written, so reads at once (the dashboard's) all get it", async () => {
    const { c, profileId } = await atNewPhase()
    // The challenge line, the plan and the week, and the calendar's week.
    const [look, plan, week, calendar] = await Promise.all([
      c.get(challengeOf(profileId)),
      c.get(`/api/profiles/${profileId}/plan`),
      c.get(`/api/profiles/${profileId}/program`),
      c.get(`/api/profiles/${profileId}/program`),
    ])
    expect(look.body).toMatchObject({ status: 'active', phase: 1 })
    expect(plan.body).toMatchObject({ exercise: 'chest_press', sets: 4, reps: 10, restSeconds: 90 })
    expect(week.body.summary).toMatch(/^Summer body, weeks 5–8 of 12: Add volume\. /)
    expect(calendar.body).toEqual(week.body)
    expect(await Program.countDocuments({ profileId })).toBe(2)
    expect(await Plan.countDocuments({ profileId })).toBe(2)
  })

  it('answers as before without a challenge', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    expect((await c.get(`/api/profiles/${profileId}/program`)).body).toEqual({ error: 'No program yet' })
    expect((await c.get(`/api/profiles/${profileId}/plan`)).body).toEqual({ error: 'No active plan' })
    expect((await c.get('/api/profiles/not-an-id/plan')).body).toEqual({ error: 'Profile not found' })
    expect((await anon.get(`/api/profiles/${profileId}/program`)).status).toBe(401)
  })
})

describe('a look at the challenge at the same moment as a leave or a start', () => {
  it('takes them in turn: the look first moves the week on and then it is left, or the leave first leaves no challenge', async () => {
    const { c, profileId } = await atNewPhase()
    const [look, leave] = await Promise.all([c.get(challengeOf(profileId)), c.delete(challengeOf(profileId))])
    expect(leave.status).toBe(204)
    const week = (await c.get(`/api/profiles/${profileId}/program`)).body
    expect([
      [200, 'active', 1, 'Summer body, weeks 5–8 of 12: Add volume'],
      [404, undefined, undefined, 'Your own week: 1 day and 1 movement'],
    ]).toContainEqual([look.status, look.body.status, look.body.phase, week.summary.split('.')[0]])
  })

  it("takes them in turn, so the old challenge's new phase never lands on the new challenge's week", async () => {
    const { c, profileId, runId } = await atNewPhase()
    const [look, start] = await Promise.all([c.get(challengeOf(profileId)), c.post(challengeOf(profileId)).send({ challengeId: 'legs_glutes' })])
    expect(start.status).toBe(201)
    // Summer body moved on (and the start then left it), or already the new challenge.
    expect(look.status).toBe(200)
    expect([runId, start.body.id]).toContain(look.body.id)
    expect(await ChallengeRun.findById(runId).lean()).toMatchObject({ status: 'left' })
    expect((await c.get(challengeOf(profileId))).body).toEqual(start.body)

    expect((await c.get(`/api/profiles/${profileId}/program`)).body.summary).toMatch(/^Legs and glutes, weeks 1–5 of 10: Groove\. /)
    expect((await c.get(`/api/profiles/${profileId}/plan`)).body).toMatchObject({ exercise: 'squat', sets: 3, reps: 12, restSeconds: 90 })
    expect(await Program.countDocuments({ profileId, active: true })).toBe(1)
    expect(await Plan.countDocuments({ profileId, active: true })).toBe(1)
  })
})

describe('a run at a challenge Arc no longer has', () => {
  /** A run stored before its challenge was renamed or dropped, written past the model's enum. */
  function storeRun(profileId: string, status: 'active' | 'done') {
    const startedAt = Date.now() - 6 * WEEK
    const ended = status === 'done' ? { endedAt: startedAt + 4 * WEEK } : {}
    return ChallengeRun.collection.insertOne({ profileId: new Types.ObjectId(profileId), challengeId: 'core_month', startedAt, status, phase: 0, createdAt: startedAt, ...ended })
  }

  it('is no challenge: one in progress is left when looked at, and another can start', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const { insertedId } = await storeRun(profileId, 'active')
    const before = Date.now()
    const res = await c.get(challengeOf(profileId))
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('No challenge')
    const left = await ChallengeRun.findById(insertedId).lean()
    expect(left).toMatchObject({ status: 'left' })
    expect(left!.endedAt).toBeGreaterThanOrEqual(before)
    expect((await c.delete(challengeOf(profileId))).status).toBe(404)
    expect((await c.post(challengeOf(profileId)).send({ challengeId: 'core_30' })).status).toBe(201)

    // A finished one is no challenge either.
    const finished = await createProfile(c, 'Grace Hopper')
    await storeRun(finished, 'done')
    expect((await c.get(challengeOf(finished))).body).toEqual({ error: 'No challenge' })
  })

  it('can be left or replaced without a look first, and does not stop the week being read', async () => {
    const c = await signup()
    const leaving = await createProfile(c)
    const left = await storeRun(leaving, 'active')
    expect((await c.delete(challengeOf(leaving))).status).toBe(204)
    expect(await ChallengeRun.findById(left.insertedId).lean()).toMatchObject({ status: 'left' })

    // Left rather than done, as it has no finish to have reached.
    const replacing = await createProfile(c, 'Grace Hopper')
    const replaced = await storeRun(replacing, 'active')
    const start = await c.post(challengeOf(replacing)).send({ challengeId: 'core_30' })
    expect(start.status).toBe(201)
    expect(await ChallengeRun.findById(replaced.insertedId).lean()).toMatchObject({ status: 'left' })
    expect((await c.get(challengeOf(replacing))).body).toEqual(start.body)

    const reading = await createProfile(c, 'Alan Turing')
    const read = await storeRun(reading, 'active')
    expect((await c.put(`/api/profiles/${reading}/program`).send({ days: [legs] })).status).toBe(201)
    expect((await c.get(`/api/profiles/${reading}/program`)).body).toMatchObject({ source: 'member', active: true })
    expect((await c.get(`/api/profiles/${reading}/plan`)).body).toMatchObject({ exercise: 'squat', sets: 3, reps: 10 })
    expect(await ChallengeRun.findById(read.insertedId).lean()).toMatchObject({ status: 'left' })
  })
})

describe('leaving a challenge (DELETE /api/profiles/:id/challenge)', () => {
  it('leaves the run in progress and keeps the week; then there is no challenge', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const run = (await c.post(challengeOf(profileId)).send({ challengeId: 'core_30' })).body as ChallengeRunDto
    const week = (await c.get(`/api/profiles/${profileId}/program`)).body
    const before = Date.now()
    expect((await c.delete(challengeOf(profileId))).status).toBe(204)

    const left = await ChallengeRun.findById(run.id).lean()
    expect(left).toMatchObject({ status: 'left' })
    expect(left!.endedAt).toBeGreaterThanOrEqual(before)
    const res = await c.get(challengeOf(profileId))
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('No challenge')
    expect((await c.get(`/api/profiles/${profileId}/program`)).body).toEqual(week)
    expect((await c.delete(challengeOf(profileId))).status).toBe(404)
  })
})

describe('who may see and change a challenge', () => {
  it("lets the camera app's key read it, but never start or leave one", async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    expect((await service().get(challengeOf(profileId))).status).toBe(404)
    const run = (await c.post(challengeOf(profileId)).send({ challengeId: 'posture' })).body as ChallengeRunDto
    expect((await service().get(challengeOf(profileId))).body).toEqual(run)
    expect((await service().post(challengeOf(profileId)).send({ challengeId: 'summer_body' })).status).toBe(403)
    // Refused before the body is read.
    expect((await service().post(challengeOf(profileId)).send({ challengeId: 'beach_body' })).status).toBe(403)
    expect((await service().delete(challengeOf(profileId))).status).toBe(403)
    expect((await c.get(challengeOf(profileId))).body).toEqual(run)
    expect(await ChallengeRun.countDocuments()).toBe(1)
  })

  it("is 404 for another account's profile or an unknown one, 400 for a challenge Arc does not have, 401 signed out", async () => {
    const mine = await signup('Ada Lovelace')
    const theirs = await signup('Grace Hopper')
    const profileId = await createProfile(mine)
    const run = (await mine.post(challengeOf(profileId)).send({ challengeId: 'v_taper' })).body as ChallengeRunDto
    expect((await theirs.get(challengeOf(profileId))).status).toBe(404)
    expect((await theirs.post(challengeOf(profileId)).send({ challengeId: 'summer_body' })).status).toBe(404)
    expect((await theirs.delete(challengeOf(profileId))).status).toBe(404)
    expect((await mine.get(challengeOf('64b64b64b64b64b64b64b64b'))).status).toBe(404)
    expect((await mine.post(challengeOf('not-an-id')).send({ challengeId: 'summer_body' })).status).toBe(404)

    const unknown = await mine.post(challengeOf(profileId)).send({ challengeId: 'beach_body' })
    expect(unknown.status).toBe(400)
    expect(unknown.body.error).toBe('Invalid request')
    expect((await mine.post(challengeOf(profileId)).send({})).status).toBe(400)
    expect((await mine.post(challengeOf(profileId)).send({ challengeId: 'summer_body', tzOffsetMinutes: 900 })).status).toBe(400)
    expect((await anon.get(challengeOf(profileId))).status).toBe(401)

    // None of it changed the run.
    expect((await mine.get(challengeOf(profileId))).body).toEqual(run)
    expect(await ChallengeRun.countDocuments()).toBe(1)
  })
})

describe('deleting', () => {
  it('removes the runs with their profile, and with the account', async () => {
    const c = await signup('Ada Lovelace')
    const profileId = await createProfile(c)
    const sibling = await createProfile(c, 'Grace Hopper')
    await c.post(challengeOf(profileId)).send({ challengeId: 'first_month' })
    await c.post(challengeOf(profileId)).send({ challengeId: 'core_30' })
    await c.post(challengeOf(sibling)).send({ challengeId: 'summer_body' })
    const stranger = await signup('Alan Turing')
    const theirs = await createProfile(stranger, 'Alan Turing')
    await stranger.post(challengeOf(theirs)).send({ challengeId: 'legs_glutes' })
    expect(await ChallengeRun.countDocuments()).toBe(4)

    expect((await c.delete(`/api/profiles/${profileId}`)).status).toBe(204)
    expect(await ChallengeRun.countDocuments({ profileId })).toBe(0)
    expect(await ChallengeRun.countDocuments()).toBe(2)

    const email = (await c.get('/api/auth/me')).body.email as string
    expect((await c.post('/api/auth/account/delete').send({ email, password: 'correct horse battery', confirm: 'DELETE' })).status).toBe(204)
    expect(await ChallengeRun.countDocuments()).toBe(1)
    expect((await stranger.get(challengeOf(theirs))).body).toMatchObject({ challengeId: 'legs_glutes', status: 'active' })
  })
})
