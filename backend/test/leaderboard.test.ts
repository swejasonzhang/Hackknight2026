import { describe, expect, it } from 'vitest'
import { createProfile, makeSession, service, signup } from './helpers.ts'

describe('the household leaderboard (GET /api/leaderboard)', () => {
  it("ranks the account's profiles on the week's reps, sets, weight moved and steadiness", async () => {
    const c = await signup('Ada Lovelace')
    const ada = await createProfile(c, 'Ada Lovelace')
    const grace = await createProfile(c, 'Grace Hopper')
    await createProfile(c, 'Alan Turing')
    const now = Date.now()
    expect((await c.post('/api/sessions').send({ ...makeSession(ada, { peaks: [120, 121, 119, 118, 117, 116], startedAt: now - 3_600_000, endedAt: now - 3_000_000 }), loadKg: 12 })).status).toBe(201)
    expect((await c.post('/api/sessions').send({ ...makeSession(grace, { peaks: [100, 101, 99], startedAt: now - 3_600_000, endedAt: now - 3_000_000 }) })).status).toBe(201)
    // An old session counts for all time, not for this week.
    expect((await c.post('/api/sessions').send({ ...makeSession(grace, { peaks: Array.from({ length: 20 }, () => 110), startedAt: now - 40 * 86_400_000, endedAt: now - 40 * 86_400_000 + 600_000 }) })).status).toBe(201)

    const week = await c.get('/api/leaderboard')
    expect(week.status).toBe(200)
    expect(week.body.window).toBe('week')
    expect(week.body.factors).toEqual(['reps', 'sets', 'volume', 'steadiness'])
    expect(week.body.rows.map((r: { name: string }) => r.name)).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing'])
    const [first, second, third] = week.body.rows
    expect(first).toMatchObject({ profileId: ada, reps: 12, sets: 2, volumeKg: 144, topLoadKg: 12, score: 100 })
    expect(second).toMatchObject({ profileId: grace, reps: 6, sets: 2, volumeKg: 0 })
    expect(third).toMatchObject({ sessions: 0, score: 0 })

    const all = (await c.get('/api/leaderboard?window=all')).body
    expect(all.rows.find((r: { name: string }) => r.name === 'Grace Hopper').reps).toBe(46)
  })

  it("never shows another account's profiles, and is for members only", async () => {
    const mine = await signup('Ada Lovelace')
    const theirs = await signup('Grace Hopper')
    await createProfile(mine, 'Ada Lovelace')
    await createProfile(theirs, 'Grace Hopper')
    expect((await mine.get('/api/leaderboard')).body.rows.map((r: { name: string }) => r.name)).toEqual(['Ada Lovelace'])
    expect((await service().get('/api/leaderboard')).status).toBe(403)
    expect((await mine.get('/api/leaderboard?window=year')).status).toBe(400)
  })

  it('keeps the weight held with a session, and refuses an impossible one', async () => {
    const c = await signup()
    const id = await createProfile(c)
    const saved = await c.post('/api/sessions').send({ ...makeSession(id), loadKg: 7.5 })
    expect(saved.body.loadKg).toBe(7.5)
    expect((await c.get(`/api/sessions/${saved.body.id}`)).body.loadKg).toBe(7.5)
    expect((await c.post('/api/sessions').send({ ...makeSession(id), loadKg: -1 })).status).toBe(400)
    expect((await c.post('/api/sessions').send({ ...makeSession(id), loadKg: 900 })).status).toBe(400)
    expect((await c.post('/api/sessions').send(makeSession(id))).body).not.toHaveProperty('loadKg')
  })
})
