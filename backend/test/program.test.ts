import { EXERCISES, type ExerciseId } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { Program } from '../src/models/Program.ts'
import { createProfile, service, signup } from './helpers.ts'

const DELETE = 'DELETE'

describe('the week Arc builds (GET /api/profiles/:id/program)', () => {
  it('is 404 until Arc has built one', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    expect((await c.get(`/api/profiles/${profileId}/program`)).status).toBe(404)
  })

  it('comes with the demo profile, Monday, Wednesday and Friday, and the camera app can read it', async () => {
    const c = await signup()
    const { profileId } = (await c.post('/api/dev/seed').send({})).body
    const res = await c.get(`/api/profiles/${profileId}/program`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ profileId, source: 'demo', active: true })
    expect(res.body.days.map((d: { weekday: number }) => d.weekday)).toEqual([1, 3, 5])
    expect((await service().get(`/api/profiles/${profileId}/program`)).status).toBe(200)
  })

  it("is not shown to another account", async () => {
    const mine = await signup('Ada Lovelace')
    const theirs = await signup('Grace Hopper')
    const { profileId } = (await mine.post('/api/dev/seed').send({})).body
    expect((await theirs.get(`/api/profiles/${profileId}/program`)).status).toBe(404)
  })

  it('goes with its profile, and with the account', async () => {
    const c = await signup()
    const { profileId } = (await c.post('/api/dev/seed').send({})).body
    expect(await Program.countDocuments()).toBe(1)
    expect((await c.delete(`/api/profiles/${profileId}`)).status).toBe(204)
    expect(await Program.countDocuments()).toBe(0)

    const other = await signup('Grace Hopper')
    await other.post('/api/dev/seed').send({})
    expect(await Program.countDocuments()).toBe(1)
    const me = (await other.get('/api/auth/me')).body
    expect((await other.post('/api/auth/account/delete').send({ email: me.email, password: 'correct horse battery', confirm: DELETE })).status).toBe(204)
    expect(await Program.countDocuments()).toBe(0)
  })
})

describe("the member's own week (PUT /api/profiles/:id/program)", () => {
  const item = (exercise: ExerciseId, muscle?: string) => ({ exercise, side: 'right', sets: 3, reps: 10, restSeconds: 60, targetDeg: EXERCISES[exercise].targetDeg, ...(muscle ? { muscle } : {}) })
  const back = { weekday: 3, title: 'Back · Lats, Upper back, Lower back', items: [item('lat_pulldown'), item('bent_over_row', 'upper_back'), item('deadlift', 'lower_back')] }
  const legs = { weekday: 1, title: 'Legs', items: [item('squat'), item('lunge'), item('seated_knee_extension')] }

  it('saves several movements a day for the muscle groups picked, Monday first, with Arc writing the summary', async () => {
    const c = await signup()
    const { profileId } = (await c.post('/api/dev/seed').send({})).body
    const res = await c.put(`/api/profiles/${profileId}/program`).send({ days: [back, legs] })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ profileId, source: 'member', active: true })
    expect(res.body.days.map((d: { weekday: number }) => d.weekday)).toEqual([1, 3])
    expect(res.body.days[1].items.map((i: { muscle?: string }) => i.muscle)).toEqual([undefined, 'upper_back', 'lower_back'])
    expect(res.body.summary).toBe('Your own week: 2 days and 6 movements. Monday quads; Wednesday lats, upper back and lower back.')

    // It is the active week now; the demo week is kept in history, newest first.
    expect((await c.get(`/api/profiles/${profileId}/program`)).body.id).toBe(res.body.id)
    const history = (await c.get(`/api/profiles/${profileId}/programs`)).body
    expect(history.map((p: { source: string; active: boolean }) => [p.source, p.active])).toEqual([
      ['member', true],
      ['demo', false],
    ])
    // Record starts from the week's first movement.
    expect((await c.get(`/api/profiles/${profileId}/plan`)).body).toMatchObject({ exercise: 'squat', sets: 3, reps: 10 })
  })

  it('takes up to eight movements a day and refuses more, an unknown muscle, or a weekday twice', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const eight = { weekday: 2, title: 'Everything', items: Array.from({ length: 8 }, () => item('crunch')) }
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [eight] })).status).toBe(201)
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [{ ...eight, items: [...eight.items, item('crunch')] }] })).status).toBe(400)
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [{ ...legs, items: [item('squat', 'neck')] }] })).status).toBe(400)
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [legs, legs] })).status).toBe(400)
    expect((await c.put(`/api/profiles/${profileId}/program`).send({ days: [] })).status).toBe(400)
  })

  it("keeps every goal inside its movement's range", async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const deadliftAt90 = { weekday: 1, title: 'Back', items: [{ ...item('deadlift'), targetDeg: 90 }] }
    const res = await c.put(`/api/profiles/${profileId}/program`).send({ days: [deadliftAt90] })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body)).toMatch(/deadlift goal must be from 160 to 180 degrees/)
    // The plan too: a front raise stops a little above shoulder height.
    const plan = { exercise: 'front_raise', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 135 }
    expect((await c.put(`/api/profiles/${profileId}/plan`).send(plan)).body.error).toBe('The front raise goal must be from 80 to 110 degrees.')
    expect((await c.put(`/api/profiles/${profileId}/plan`).send({ ...plan, targetDeg: 95 })).status).toBe(201)
    expect((await c.patch(`/api/profiles/${profileId}/plan`).send({ targetDeg: 150 })).status).toBe(400)
    expect((await c.patch(`/api/profiles/${profileId}/plan`).send({ sets: 4 })).status).toBe(200)
  })

  it("is the member's alone: not another account's, and never the camera app's", async () => {
    const mine = await signup('Ada Lovelace')
    const theirs = await signup('Grace Hopper')
    const { profileId } = (await mine.post('/api/dev/seed').send({})).body
    expect((await theirs.put(`/api/profiles/${profileId}/program`).send({ days: [legs] })).status).toBe(404)
    expect((await theirs.get(`/api/profiles/${profileId}/programs`)).status).toBe(404)
    expect((await service().put(`/api/profiles/${profileId}/program`).send({ days: [legs] })).status).toBe(403)
    expect((await service().get(`/api/profiles/${profileId}/programs`)).status).toBe(200)
  })
})
