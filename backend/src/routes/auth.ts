import { LoginSchema, SignupSchema, type AuthResponse } from '@arc/dependencies'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { authenticate, requireUser, signToken } from '../auth.ts'
import { db } from '../db.ts'
import { HttpError, validate } from '../http.ts'
import { createUser, findUserByEmail, findUserById, toUserDto } from '../store/users.ts'

const BCRYPT_ROUNDS = 10

/** Mounted at /api/auth */
export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
  const input = validate(SignupSchema, req.body)
  if (await findUserByEmail(db(), input.email)) throw new HttpError(409, 'An account with this email already exists')
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  const user = await createUser(db(), { name: input.name, email: input.email, passwordHash })
  const body: AuthResponse = { token: signToken(user.id), user: toUserDto(user) }
  res.status(201).json(body)
})

authRouter.post('/login', async (req, res) => {
  const input = validate(LoginSchema, req.body)
  const user = await findUserByEmail(db(), input.email)
  const ok = user ? await bcrypt.compare(input.password, user.password_hash) : false
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password')
  const body: AuthResponse = { token: signToken(user.id), user: toUserDto(user) }
  res.json(body)
})

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await findUserById(db(), requireUser(req))
  if (!user) throw new HttpError(401, 'Account no longer exists')
  res.json(toUserDto(user))
})
