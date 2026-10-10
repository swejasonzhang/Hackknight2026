import { estimateFatigue } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { createProfile, makeSession, signup } from './helpers.ts'

describe('sessions', () => {
  it('POST /api/sessions stores a session and recomputes fatigue and the summary server-side', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const body = makeSession(profileId)
    const res = await c.post('/api/sessions').send(body)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ profileId, exercise: 'elbow_flexion', side: 'right', demo: false })
    expect(typeof res.body.id).toBe('string')

    const expectedFatigue = estimateFatigue(body.sets[0]!.reps)
    expect(res.body.sets[0].fatigue.index).toBeCloseTo(expectedFatigue.index, 6)
    expect(res.body.sets[0].fatigue.romDropDeg).toBeCloseTo(expectedFatigue.romDropDeg, 6)
    expect(res.body.sets[0].fatigue.sampleReps).toBe(4)

    expect(res.body.summary.totalReps).toBe(8)
    expect(res.body.summary.bestPeakDeg).toBe(120)
    expect(res.body.summary.meanPeakDeg).toBeCloseTo((120 + 119 + 117 + 114 + 116 + 115 + 112 + 110) / 8, 6)
    expect(res.body.summary.fatigueIndex).toBeGreaterThan(0)
  })

  it('rejects invalid bodies and unknown profiles', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    expect((await c.post('/api/sessions').send({ ...makeSession(profileId), sets: [] })).status).toBe(400)
    expect((await c.post('/api/sessions').send({ ...makeSession(profileId), endedAt: 1 })).status).toBe(400)
    expect((await c.post('/api/sessions').send(makeSession('64b64b64b64b64b64b64b64b'))).status).toBe(404)
    expect((await c.post('/api/sessions').send(makeSession('nope'))).status).toBe(404)
  })

  it('GET /api/profiles/:id/sessions lists newest first and filters by exercise', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const day = 24 * 3600 * 1000
    const t0 = Date.UTC(2026, 9, 1, 18)
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: t0 }))
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: t0 + 2 * day }))
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: t0 + day, exercise: 'seated_knee_extension' }))

    const all = await c.get(`/api/profiles/${profileId}/sessions`)
    expect(all.status).toBe(200)
    expect(all.body.map((s: { startedAt: number }) => s.startedAt)).toEqual([t0 + 2 * day, t0 + day, t0])

    const knee = await c.get(`/api/profiles/${profileId}/sessions?exercise=seated_knee_extension`)
    expect(knee.body).toHaveLength(1)
    expect(knee.body[0].exercise).toBe('seated_knee_extension')

    const bad = await c.get(`/api/profiles/${profileId}/sessions?exercise=jumping_jacks`)
    expect(bad.status).toBe(400)
  })

  it('GET /api/sessions/:id returns one session or 404', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const created = await c.post('/api/sessions').send(makeSession(profileId))
    const ok = await c.get(`/api/sessions/${created.body.id}`)
    expect(ok.status).toBe(200)
    expect(ok.body.id).toBe(created.body.id)
    expect(ok.body.sets).toHaveLength(2)
    expect((await c.get('/api/sessions/64b64b64b64b64b64b64b64b')).status).toBe(404)
  })
})
