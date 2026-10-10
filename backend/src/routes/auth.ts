import { DeleteAccountSchema, LoginSchema, SignupSchema, type AuthResponse } from '@arc/dependencies'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { authenticate, requireUser, signToken } from '../auth.ts'
import { HttpError, validate } from '../http.ts'
import { CoachMessage } from '../models/CoachMessage.ts'
import { Plan } from '../models/Plan.ts'
import { Profile } from '../models/Profile.ts'
import { Session } from '../models/Session.ts'
import { toUserDto, User, type UserShape } from '../models/User.ts'

const BCRYPT_ROUNDS = 10

/** Mounted at /api/auth */
export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
  const input = validate(SignupSchema, req.body)
  if (await User.exists({ email: input.email })) throw new HttpError(409, 'An account with this email already exists')
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  const user = await User.create({ name: input.name, email: input.email, passwordHash, createdAt: Date.now() })
  const body: AuthResponse = { token: signToken(user._id.toString()), user: toUserDto(user) }
  res.status(201).json(body)
})

authRouter.post('/login', async (req, res) => {
  const input = validate(LoginSchema, req.body)
  const user = await User.findOne({ email: input.email }).lean<UserShape>()
  const ok = user ? await bcrypt.compare(input.password, user.passwordHash) : false
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password')
  const body: AuthResponse = { token: signToken(user._id.toString()), user: toUserDto(user) }
  res.json(body)
})

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(requireUser(req)).lean<UserShape>()
  if (!user) throw new HttpError(401, 'Account no longer exists')
  res.json(toUserDto(user))
})

/** Wrong passwords per account in the last 15 minutes; after five, deletion stops checking for a while. */
const failures = new Map<string, number[]>()
const FAILURE_WINDOW_MS = 15 * 60_000
const MAX_FAILURES = 5

/**
 * Deletes the signed-in account and everything in it (profiles, plans, sessions, Arc's messages),
 * permanently. It takes the account's own email and password again and DELETE typed out; another
 * account's credentials, a wrong password or a missing confirmation change nothing. The password
 * is only compared, never logged or echoed. Children go first and the account last, so a failure
 * part-way leaves the account in place to try again.
 */
authRouter.post('/account/delete', authenticate, async (req, res) => {
  const userId = requireUser(req)
  const key = userId.toString()
  const now = Date.now()
  const recent = (failures.get(key) ?? []).filter((t) => now - t < FAILURE_WINDOW_MS)
  if (recent.length >= MAX_FAILURES) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.')

  const input = validate(DeleteAccountSchema, req.body)
  const user = await User.findById(userId).lean<UserShape>()
  const ok = user != null && user.email === input.email && (await bcrypt.compare(input.password, user.passwordHash))
  if (!ok) {
    failures.set(key, [...recent, now])
    // 403, not 401: the session is still valid, and a 401 would sign the member out over a typo.
    throw new HttpError(403, 'That email and password do not match this account')
  }

  const profileIds = (await Profile.find({ ownerId: userId }, { _id: 1 }).lean()).map((p) => p._id)
  await CoachMessage.deleteMany({ ownerId: userId })
  await Session.deleteMany({ profileId: { $in: profileIds } })
  await Plan.deleteMany({ profileId: { $in: profileIds } })
  await Profile.deleteMany({ ownerId: userId })
  await User.deleteOne({ _id: userId })
  failures.delete(key)
  res.status(204).end()
})
