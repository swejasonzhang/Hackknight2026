import { describe, expect, it } from 'vitest'
import { anon, createProfile, makeSession, service, signup } from './helpers.ts'

const creds = { name: 'Grace Hopper', email: 'Grace@Example.com', password: 'correct horse battery' }

describe('accounts', () => {
  it('POST /api/auth/signup creates an account and returns a token plus the user', async () => {
    const res = await anon.post('/api/auth/signup').send(creds)
    expect(res.status).toBe(201)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user).toMatchObject({ name: 'Grace Hopper', email: 'grace@example.com' })
    expect(typeof res.body.user.id).toBe('string')
    expect(res.body.user.passwordHash).toBeUndefined()
    expect(res.body.user.password).toBeUndefined()
  })

  it('rejects a duplicate email with 409 and a bad body with 400', async () => {
    await anon.post('/api/auth/signup').send(creds)
    expect((await anon.post('/api/auth/signup').send({ ...creds, name: 'Other' })).status).toBe(409)
    expect((await anon.post('/api/auth/signup').send({ ...creds, email: 'nope' })).status).toBe(400)
    expect((await anon.post('/api/auth/signup').send({ ...creds, password: 'short' })).status).toBe(400)
  })

  it('POST /api/auth/login returns a token for the right password only', async () => {
    await anon.post('/api/auth/signup').send(creds)
    const ok = await anon.post('/api/auth/login').send({ email: 'grace@example.com', password: creds.password })
    expect(ok.status).toBe(200)
    expect(typeof ok.body.token).toBe('string')
    expect(ok.body.user.email).toBe('grace@example.com')
    expect((await anon.post('/api/auth/login').send({ email: creds.email, password: 'wrong password' })).status).toBe(401)
    expect((await anon.post('/api/auth/login').send({ email: 'nobody@example.com', password: creds.password })).status).toBe(401)
  })

  it('GET /api/auth/me identifies the token holder', async () => {
    const c = await signup('Ada Lovelace')
    const me = await c.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body).toMatchObject({ id: c.userId, name: 'Ada Lovelace' })
    expect((await anon.get('/api/auth/me')).status).toBe(401)
    expect((await anon.get('/api/auth/me').set('Authorization', 'Bearer not-a-token')).status).toBe(401)
  })
})

describe('access control', () => {
  it('data routes need a signed-in user or the CV api key', async () => {
    expect((await anon.get('/api/profiles')).status).toBe(401)
    expect((await anon.get('/api/profiles').set('x-api-key', 'wrong')).status).toBe(401)
    expect((await service().get('/api/profiles')).status).toBe(200)
    expect((await anon.get('/api/health')).status).toBe(200)
  })

  it('a user only sees their own profiles; the CV service sees all of them', async () => {
    const a = await signup('A')
    const b = await signup('B')
    const idA = await createProfile(a, 'Ada')
    await createProfile(b, 'Bob')

    expect((await a.get('/api/profiles')).body.map((p: { name: string }) => p.name)).toEqual(['Ada'])
    expect((await b.get('/api/profiles')).body.map((p: { name: string }) => p.name)).toEqual(['Bob'])
    expect((await b.get(`/api/profiles/${idA}`)).status).toBe(404)
    expect((await b.get(`/api/profiles/${idA}/sessions`)).status).toBe(404)
    expect((await b.put(`/api/profiles/${idA}/plan`).send({ exercise: 'elbow_flexion', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 })).status).toBe(404)
    expect((await b.post('/api/sessions').send(makeSession(idA))).status).toBe(404)

    const all = await service().get('/api/profiles')
    expect(all.body.map((p: { name: string }) => p.name).sort()).toEqual(['Ada', 'Bob'])
    expect((await service().get(`/api/profiles/${idA}`)).status).toBe(200)
  })

  it('the CV service can store sessions and read the plan for any profile, but cannot create profiles', async () => {
    const a = await signup()
    const id = await createProfile(a)
    await a.put(`/api/profiles/${id}/plan`).send({ exercise: 'elbow_flexion', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 })
    expect((await service().get(`/api/profiles/${id}/plan`)).status).toBe(200)
    const stored = await service().post('/api/sessions').send(makeSession(id))
    expect(stored.status).toBe(201)
    expect((await a.get(`/api/profiles/${id}/sessions`)).body).toHaveLength(1)
    expect((await service().post('/api/profiles').send({ name: 'Nope' })).status).toBe(403)
  })

  it('profiles carry their owner id', async () => {
    const a = await signup()
    const id = await createProfile(a)
    expect((await a.get(`/api/profiles/${id}`)).body.ownerId).toBe(a.userId)
  })
})
