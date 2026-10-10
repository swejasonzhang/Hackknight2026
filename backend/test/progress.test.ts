import { describe, expect, it } from 'vitest'
import { createProfile, makeSession, signup } from './helpers.ts'

const plan = { exercise: 'elbow_flexion', side: 'right', sets: 2, reps: 4, restSeconds: 45, targetDeg: 140 }

describe('GET /api/profiles/:id/progress', () => {
  it('aggregates one exercise into dashboard series, oldest first, with the plan target', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    await c.put(`/api/profiles/${profileId}/plan`).send(plan)
    const week = 7 * 24 * 3600 * 1000
    const t0 = Date.UTC(2026, 8, 7, 18) // Monday 7 Sep 2026
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: t0 + 2 * week }))
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: t0 }))
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: t0 + week }))
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: t0 + week, exercise: 'shoulder_abduction' }))

    const res = await c.get(`/api/profiles/${profileId}/progress?exercise=elbow_flexion`)
    expect(res.status).toBe(200)
    expect(res.body.profileId).toBe(profileId)
    expect(res.body.exercise).toBe('elbow_flexion')
    expect(res.body.targetDeg).toBe(140)
    expect(res.body.sessions.map((s: { date: number }) => s.date)).toEqual([t0, t0 + week, t0 + 2 * week])
    expect(res.body.sessions[0]).toMatchObject({ bestPeakDeg: 120, totalReps: 8, demo: false })
    expect(res.body.sessions[0].fatigueIndex).toBeGreaterThan(0)
    expect(res.body.sessionsPerWeek).toEqual([
      { weekStart: '2026-09-07', count: 1 },
      { weekStart: '2026-09-14', count: 1 },
      { weekStart: '2026-09-21', count: 1 },
    ])
    expect(res.body.latestSessionReps).toHaveLength(8)
    expect(res.body.latestSessionReps[0]).toEqual({ label: 'S1 R1', setNumber: 1, index: 1, peakDeg: 120 })
    expect(res.body.latestSessionReps[4]).toEqual({ label: 'S2 R1', setNumber: 2, index: 1, peakDeg: 116 })
  })

  it('has a null target when no plan covers the exercise and empty series with no sessions', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const res = await c.get(`/api/profiles/${profileId}/progress?exercise=seated_knee_extension`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ targetDeg: null, sessions: [], sessionsPerWeek: [], latestSessionReps: [] })
  })

  it('requires a valid exercise and an existing profile', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    expect((await c.get(`/api/profiles/${profileId}/progress`)).status).toBe(400)
    expect((await c.get(`/api/profiles/${profileId}/progress?exercise=jumping_jacks`)).status).toBe(400)
    expect((await c.get('/api/profiles/64b64b64b64b64b64b64b64b/progress?exercise=elbow_flexion')).status).toBe(404)
  })
})
