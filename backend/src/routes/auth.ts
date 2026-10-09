import { LoginSchema, SignupSchema, type AuthResponse } from '@ptg/dependencies'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { authenticate, requireUser, signToken } from '../auth.ts'
import { HttpError, validate } from '../http.ts'
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
