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
