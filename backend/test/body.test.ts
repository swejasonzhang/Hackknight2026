import { bodyGrowth, MUSCLE_IDS, weekStartIso, type BodyDto, type SessionDto } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { anon, createProfile, makeSession, service, signup } from './helpers.ts'

const DAY = 86_400_000
const WEEK = 7 * DAY
const EIGHT = [120, 121, 119, 118, 117, 116, 115, 114]
/** The Monday, 00:00 UTC, that starts the week holding `t`: the weeks progress counts sessions in. */
const monday = (t: number) => Date.parse(weekStartIso(t))

describe("the body a profile's training grew (GET /api/profiles/:id/body)", () => {
  it('grows the muscles the sessions worked and leaves the rest at the skinny start', async () => {
    const c = await signup()
    const id = await createProfile(c)
    const now = Date.now()
    // Weighted curls two days ago and bodyweight squats sixteen days ago, two sets of eight each.
    expect((await c.post('/api/sessions').send({ ...makeSession(id, { peaks: EIGHT, startedAt: now - 2 * DAY }), loadKg: 10 })).status).toBe(201)
    expect((await c.post('/api/sessions').send(makeSession(id, { exercise: 'squat', peaks: EIGHT.map((p) => p - 25), startedAt: now - 16 * DAY }))).status).toBe(201)
    // Chest presses on the account's other profile and crunches on another account's: neither is this profile's training.
    const sibling = await createProfile(c, 'Grace Hopper')
    expect((await c.post('/api/sessions').send(makeSession(sibling, { exercise: 'chest_press', peaks: EIGHT, startedAt: now - 2 * DAY }))).status).toBe(201)
    const stranger = await signup('Alan Turing')
    const strangerProfile = await createProfile(stranger, 'Alan Turing')
    expect((await stranger.post('/api/sessions').send(makeSession(strangerProfile, { exercise: 'crunch', peaks: EIGHT, startedAt: now - 2 * DAY }))).status).toBe(201)

    const res = await c.get(`/api/profiles/${id}/body`)
    expect(res.status).toBe(200)
    const body = res.body as BodyDto
    expect(body).toMatchObject({ profileId: id, figure: null })
    expect(body.asOf).toBeGreaterThanOrEqual(now)
    expect(Object.keys(body.muscles).sort()).toEqual([...MUSCLE_IDS].sort())
    for (const worked of ['biceps', 'forearms', 'quads', 'glutes', 'hamstrings', 'lower_back', 'calves'] as const) expect(body.muscles[worked].level, worked).toBeGreaterThan(0)
    for (const rested of ['chest', 'lats', 'abs', 'triceps'] as const) expect(body.muscles[rested].level, rested).toBe(0)
    // Two full sets of curls for the biceps, half of each for the forearms that help.
    expect(body.muscles.biceps).toMatchObject({ recentSets: 2, totalSets: 2 })
    expect(body.muscles.forearms).toMatchObject({ recentSets: 1, totalSets: 1 })
    expect(body.overall).toBeGreaterThan(0)
    // One window a week, Monday to Monday (UTC), from the squats' week to this one: three or four, by the weekday.
    const first = monday(now - 16 * DAY)
    const count = (monday(body.asOf) - first) / WEEK + 1
    expect(body.weeks.map((w) => w.from)).toEqual(Array.from({ length: count }, (_, i) => first + i * WEEK))
    for (const w of body.weeks) expect(Object.keys(w.levels).sort()).toEqual([...MUSCLE_IDS].sort())

    // Exactly what the model gives for the stored sessions at that moment.
    const sessions = (await c.get(`/api/profiles/${id}/sessions`)).body as SessionDto[]
    expect(body).toEqual({ profileId: id, figure: null, ...bodyGrowth(sessions, { now: body.asOf }) })
  })

  it("starts a profile with no training at the skinny start, and lets the camera app's key read it", async () => {
    const c = await signup()
    const id = await createProfile(c)
    const res = await service().get(`/api/profiles/${id}/body`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ profileId: id, figure: null, overall: 0, weeks: [] })
    expect(res.body.muscles.biceps).toEqual({ level: 0, recentSets: 0, totalSets: 0, change: 0 })
  })

  it("is 404 for another account's profile or an unknown one, and 401 signed out", async () => {
    const mine = await signup('Ada Lovelace')
    const theirs = await signup('Grace Hopper')
    const id = await createProfile(mine)
    expect((await theirs.get(`/api/profiles/${id}/body`)).status).toBe(404)
    expect((await mine.get('/api/profiles/64b64b64b64b64b64b64b64b/body')).status).toBe(404)
    expect((await mine.get('/api/profiles/not-an-id/body')).status).toBe(404)
    expect((await anon.get(`/api/profiles/${id}/body`)).status).toBe(401)
  })
})

describe("the profile's figure (POST /api/profiles, PATCH /api/profiles/:id)", () => {
  it('creates a profile with a figure, without one, and refuses one it does not know', async () => {
    const c = await signup()
    const res = await c.post('/api/profiles').send({ name: 'Ada Lovelace', figure: 'female' })
    expect(res.status).toBe(201)
    expect(res.body.figure).toBe('female')
    expect((await c.get(`/api/profiles/${res.body.id}`)).body.figure).toBe('female')
    expect((await c.post('/api/profiles').send({ name: 'Grace Hopper' })).body).not.toHaveProperty('figure')
    expect((await c.post('/api/profiles').send({ name: 'Alan Turing', figure: 'robot' })).status).toBe(400)
  })

  it('sets and changes the figure, clears it with null, and the body follows', async () => {
    const c = await signup()
    const id = await createProfile(c)
    const set = await c.patch(`/api/profiles/${id}`).send({ figure: 'male' })
    expect(set.status).toBe(200)
    expect(set.body).toMatchObject({ id, name: 'Ada Lovelace', ownerId: c.userId, figure: 'male' })
    expect((await c.get(`/api/profiles/${id}`)).body.figure).toBe('male')
    expect((await c.get(`/api/profiles/${id}/body`)).body.figure).toBe('male')
    expect((await c.patch(`/api/profiles/${id}`).send({ figure: 'female' })).body.figure).toBe('female')

    const cleared = await c.patch(`/api/profiles/${id}`).send({ figure: null })
    expect(cleared.status).toBe(200)
    expect(cleared.body).not.toHaveProperty('figure')
    expect((await c.get(`/api/profiles/${id}`)).body).not.toHaveProperty('figure')
    expect((await c.get(`/api/profiles/${id}/body`)).body.figure).toBeNull()
  })

  it("refuses an unknown figure or any other field (400), another account's profile (404) and the camera app (403)", async () => {
    const mine = await signup('Ada Lovelace')
    const theirs = await signup('Grace Hopper')
    const id = await createProfile(mine)
    const invalid = await mine.patch(`/api/profiles/${id}`).send({ figure: 'robot' })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error).toBe('Invalid request')
    expect((await mine.patch(`/api/profiles/${id}`).send({ figure: 'male', name: 'Eve' })).status).toBe(400)
    expect((await mine.patch(`/api/profiles/${id}`).send({ name: 'Eve' })).status).toBe(400)
    expect((await mine.patch(`/api/profiles/${id}`).send({})).status).toBe(400)
    expect((await theirs.patch(`/api/profiles/${id}`).send({ figure: 'male' })).status).toBe(404)
    expect((await mine.patch('/api/profiles/64b64b64b64b64b64b64b64b').send({ figure: 'male' })).status).toBe(404)
    expect((await mine.patch('/api/profiles/not-an-id').send({ figure: 'male' })).status).toBe(404)
    expect((await service().patch(`/api/profiles/${id}`).send({ figure: 'male' })).status).toBe(403)
    // None of it changed the profile.
    const profile = (await mine.get(`/api/profiles/${id}`)).body
    expect(profile.name).toBe('Ada Lovelace')
    expect(profile).not.toHaveProperty('figure')
  })
})
