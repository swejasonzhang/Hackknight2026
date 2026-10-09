import { describe, expect, it } from 'vitest'
import { createProfile, makeSession, signup } from './helpers.ts'

describe('profiles', () => {
  it('POST /api/profiles creates a profile and returns it with an id', async () => {
    const c = await signup()
    const res = await c.post('/api/profiles').send({ name: '  Ada Lovelace ', email: 'ada@example.com' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com', ownerId: c.userId })
    expect(typeof res.body.id).toBe('string')
    expect(typeof res.body.createdAt).toBe('number')
    expect(res.body._id).toBeUndefined()
  })

  it('POST /api/profiles rejects an invalid body with 400 and zod issues', async () => {
    const c = await signup()
    const res = await c.post('/api/profiles').send({ name: '', email: 'nope' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request')
    expect(Array.isArray(res.body.issues)).toBe(true)
  })

  it('GET /api/profiles lists the account\'s profiles, newest first', async () => {
    const c = await signup()
    await c.post('/api/profiles').send({ name: 'First' })
    await c.post('/api/profiles').send({ name: 'Second' })
    const res = await c.get('/api/profiles')
    expect(res.status).toBe(200)
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Second', 'First'])
  })

  it('GET /api/profiles/:id returns one profile, 404 for unknown or malformed ids', async () => {
    const c = await signup()
    const created = await c.post('/api/profiles').send({ name: 'Grace' })
    const ok = await c.get(`/api/profiles/${created.body.id}`)
    expect(ok.status).toBe(200)
    expect(ok.body.name).toBe('Grace')
    expect((await c.get('/api/profiles/64b64b64b64b64b64b64b64b')).status).toBe(404)
    expect((await c.get('/api/profiles/not-an-id')).status).toBe(404)
  })

  it('DELETE /api/profiles/:id removes the profile with its plans and sessions', async () => {
    const c = await signup()
    const id = await createProfile(c)
    await c.put(`/api/profiles/${id}/plan`).send({ exercise: 'elbow_flexion', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 })
    const session = await c.post('/api/sessions').send(makeSession(id))
    expect((await c.delete(`/api/profiles/${id}`)).status).toBe(204)
    expect((await c.get(`/api/profiles/${id}`)).status).toBe(404)
    expect((await c.get(`/api/sessions/${session.body.id}`)).status).toBe(404)
    expect((await c.get('/api/profiles')).body).toEqual([])
    expect((await c.delete(`/api/profiles/${id}`)).status).toBe(404)
  })
})
