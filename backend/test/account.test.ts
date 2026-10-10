import { describe, expect, it } from 'vitest'
import { CoachMessage } from '../src/models/CoachMessage.ts'
import { Plan } from '../src/models/Plan.ts'
import { Profile } from '../src/models/Profile.ts'
import { Session } from '../src/models/Session.ts'
import { User } from '../src/models/User.ts'
import { anon, createProfile, makeSession, service, signup } from './helpers.ts'

const PASSWORD = 'correct horse battery'
const emailOf = async (c: Awaited<ReturnType<typeof signup>>) => (await c.get('/api/auth/me')).body.email as string

/** An account with a profile, a plan, a session and a line from Arc. */
async function fullAccount(name = 'Ada Lovelace') {
  const c = await signup(name)
  const profileId = await createProfile(c)
  await c.put(`/api/profiles/${profileId}/plan`).send({ exercise: 'elbow_flexion', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 })
  await c.post('/api/sessions').send(makeSession(profileId))
  await c.post('/api/coach/onboarding').send({ messages: [] })
  return { c, profileId, email: await emailOf(c) }
}

describe('deleting an account', () => {
  it('needs the signed-in person', async () => {
    expect((await anon.post('/api/auth/account/delete').send({ email: 'a@example.com', password: PASSWORD, confirm: 'DELETE' })).status).toBe(401)
    expect((await service().post('/api/auth/account/delete').send({ email: 'a@example.com', password: PASSWORD, confirm: 'DELETE' })).status).toBe(403)
  })

  it('refuses a wrong password without ending the session, and never sends the password back', async () => {
    const { c, email } = await fullAccount()
    const res = await c.post('/api/auth/account/delete').send({ email, password: 'not my password', confirm: 'DELETE' })
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain('not my password')
    expect(await User.countDocuments()).toBe(1)
    expect((await c.get('/api/auth/me')).status).toBe(200)
  })

  it("refuses another account's credentials, even correct ones", async () => {
    const mine = await fullAccount('Ada Lovelace')
    const theirs = await fullAccount('Grace Hopper')
    const res = await mine.c.post('/api/auth/account/delete').send({ email: theirs.email, password: PASSWORD, confirm: 'DELETE' })
    expect(res.status).toBe(403)
    expect(await User.countDocuments()).toBe(2)
  })

  it('needs DELETE typed to confirm', async () => {
    const { c, email } = await fullAccount()
    expect((await c.post('/api/auth/account/delete').send({ email, password: PASSWORD, confirm: 'delete' })).status).toBe(400)
    expect((await c.post('/api/auth/account/delete').send({ email, password: PASSWORD })).status).toBe(400)
    expect(await User.countDocuments()).toBe(1)
  })

  it("removes the account and everything in it, and leaves everyone else's data alone", async () => {
    const mine = await fullAccount('Ada Lovelace')
    const theirs = await fullAccount('Grace Hopper')
    const res = await mine.c.post('/api/auth/account/delete').send({ email: mine.email.toUpperCase(), password: PASSWORD, confirm: 'DELETE' })
    expect(res.status).toBe(204)

    expect(await User.countDocuments()).toBe(1)
    expect(await Profile.countDocuments()).toBe(1)
    expect(await Plan.countDocuments()).toBe(1)
    expect(await Session.countDocuments()).toBe(1)
    const remaining = await CoachMessage.find().lean()
    expect(remaining.length).toBeGreaterThan(0)
    expect(remaining.every((m) => m.ownerId.toString() === theirs.c.userId)).toBe(true)

    // The deleted account's token stops working at once, everywhere.
    expect((await mine.c.get('/api/auth/me')).status).toBe(401)
    expect((await mine.c.get('/api/profiles')).status).toBe(401)
    expect((await mine.c.post('/api/profiles').send({ name: 'Ghost' })).status).toBe(401)
    expect((await theirs.c.get(`/api/profiles/${theirs.profileId}/sessions`)).body).toHaveLength(1)
  })

  it('slows down guessing: after five wrong passwords, it stops checking for a while', async () => {
    const { c, email } = await fullAccount()
    for (let i = 0; i < 5; i++) expect((await c.post('/api/auth/account/delete').send({ email, password: `guess ${i}`, confirm: 'DELETE' })).status).toBe(403)
    expect((await c.post('/api/auth/account/delete').send({ email, password: PASSWORD, confirm: 'DELETE' })).status).toBe(429)
    expect(await User.countDocuments()).toBe(1)
  })
})
