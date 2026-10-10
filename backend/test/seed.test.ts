import request from 'supertest'
import { createApp } from '../src/app.ts'
import { describe, expect, it } from 'vitest'
import { signup } from './helpers.ts'

describe('POST /api/dev/seed', () => {
  it('creates a demo profile with weeks of demo sessions and an active plan', async () => {
    const c = await signup()
    const res = await c.post('/api/dev/seed')
    expect(res.status).toBe(201)
    expect(typeof res.body.profileId).toBe('string')
    expect(res.body.sessions).toBeGreaterThanOrEqual(30)

    const sessions = await c.get(`/api/profiles/${res.body.profileId}/sessions`)
    expect(sessions.body).toHaveLength(res.body.sessions)
    expect(sessions.body.every((s: { demo: boolean }) => s.demo)).toBe(true)

    const plan = await c.get(`/api/profiles/${res.body.profileId}/plan`)
    expect(plan.status).toBe(200)
  })

  it("schedules the demo sessions at the caller's local training hours", async () => {
    const c = await signup()
    const res = await c.post('/api/dev/seed').send({ tzOffsetMinutes: 240 })
    expect(res.status).toBe(201)
    const sessions = (await c.get(`/api/profiles/${res.body.profileId}/sessions`)).body as { startedAt: number }[]
    const localHours = sessions.map((s) => new Date(s.startedAt - 240 * 60_000).getUTCHours())
    expect(localHours.every((h) => h >= 7 && h <= 20)).toBe(true)
  })

  it('rejects a timezone offset that is not a real one', async () => {
    const c = await signup()
    expect((await c.post('/api/dev/seed').send({ tzOffsetMinutes: 5000 })).status).toBe(400)
    expect((await c.post('/api/dev/seed').send({ tzOffsetMinutes: 'EST' })).status).toBe(400)
  })

  it('is idempotent: seeding twice reuses the demo profile', async () => {
    const c = await signup()
    const a = await c.post('/api/dev/seed')
    const b = await c.post('/api/dev/seed')
    expect(b.status).toBe(200)
    expect(b.body.profileId).toBe(a.body.profileId)
    expect(b.body.sessions).toBe(a.body.sessions)
    expect((await c.get('/api/profiles')).body).toHaveLength(1)
  })

  it('gives each account its own random demo data', async () => {
    const a = await signup('A')
    const b = await signup('B')
    const ra = await a.post('/api/dev/seed')
    const rb = await b.post('/api/dev/seed')
    const peaks = async (c: typeof a, id: string) => ((await c.get(`/api/profiles/${id}/sessions`)).body as { summary: { bestPeakDeg: number } }[]).map((s) => s.summary.bestPeakDeg)
    expect(await peaks(a, ra.body.profileId)).not.toEqual(await peaks(b, rb.body.profileId))
  })

  it('is available in production to signed-in accounts, never to the camera app key', async () => {
    const c = await signup()
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const prod = createApp()
      expect((await request(prod).post('/api/dev/seed').set('x-api-key', process.env.CV_API_KEY ?? '')).status).toBe(403)
      expect((await request(prod).post('/api/dev/seed').set('Authorization', `Bearer ${c.token}`)).status).toBe(201)
    } finally {
      process.env.NODE_ENV = previous
    }
  })

  it('is not mounted when explicitly disabled', async () => {
    const c = await signup()
    const prod = createApp({ allowDevRoutes: false })
    const res = await request(prod).post('/api/dev/seed').set('Authorization', `Bearer ${c.token}`)
    expect(res.status).toBe(404)
  })
})
