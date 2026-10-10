import { describe, expect, it } from 'vitest'
import { Session } from '../src/models/Session.ts'
import { createProfile, makeSession, service, signup } from './helpers.ts'

/** Saving set by set: a recording is in MongoDB from its first set, and every later set joins it. */
describe('a session saved as it is recorded', () => {
  it('is created after the first set, grows with each set, and is marked complete at the end', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const full = makeSession(profileId)
    const first = await c.post('/api/sessions').send({ ...full, sets: full.sets.slice(0, 1), endedAt: full.sets[0]!.endedAt, complete: false })
    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({ complete: false, summary: { totalReps: 4 } })
    // Already in MongoDB, and already on the dashboard's charts.
    expect(await Session.countDocuments({ profileId })).toBe(1)
    const progress = (await c.get(`/api/profiles/${profileId}/progress?exercise=elbow_flexion`)).body
    expect(progress.sessions).toHaveLength(1)

    const done = await c.put(`/api/sessions/${first.body.id}`).send({ ...full, complete: true })
    expect(done.status).toBe(200)
    expect(done.body).toMatchObject({ id: first.body.id, complete: true, summary: { totalReps: 8 } })
    expect(done.body.sets).toHaveLength(2)
    // The server recomputed fatigue rather than trusting the body.
    expect(done.body.sets[1].fatigue.sampleReps).toBe(4)
    expect(await Session.countDocuments({ profileId })).toBe(1)
  })

  it('keeps the sets already saved when a recording never finishes', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const full = makeSession(profileId)
    await c.post('/api/sessions').send({ ...full, sets: full.sets.slice(0, 1), endedAt: full.sets[0]!.endedAt, complete: false })
    const [stored] = (await c.get(`/api/profiles/${profileId}/sessions`)).body
    expect(stored).toMatchObject({ complete: false })
    expect(stored.sets).toHaveLength(1)
  })

  it('treats a session sent whole (the camera app) as complete', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const res = await service().post('/api/sessions').send(makeSession(profileId))
    expect(res.body.complete).toBe(true)
  })

  it("never changes a finished session, another profile, or someone else's", async () => {
    const mine = await signup('Ada Lovelace')
    const theirs = await signup('Grace Hopper')
    const profileId = await createProfile(mine)
    const otherProfile = await createProfile(mine, 'Grace')
    const full = makeSession(profileId)
    const open = (await mine.post('/api/sessions').send({ ...full, sets: full.sets.slice(0, 1), endedAt: full.sets[0]!.endedAt, complete: false })).body
    expect((await theirs.put(`/api/sessions/${open.id}`).send(full)).status).toBe(404)
    expect((await mine.put(`/api/sessions/${open.id}`).send({ ...full, profileId: otherProfile })).status).toBe(400)
    expect((await mine.put(`/api/sessions/${open.id}`).send({ ...full, complete: true })).status).toBe(200)
    expect((await mine.put(`/api/sessions/${open.id}`).send({ ...full, complete: true })).status).toBe(409)
    expect((await mine.put('/api/sessions/64b64b64b64b64b64b64b64b').send(full)).status).toBe(404)
  })
})
