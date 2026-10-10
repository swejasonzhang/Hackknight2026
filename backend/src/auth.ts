import { timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { HttpError } from './http.ts'
import { isUuid } from './sql.ts'

/** Who is calling: a signed-in account, or the computer-vision module with the shared API key. */
export type Principal = { kind: 'user'; userId: string } | { kind: 'service' }

declare global {
  namespace Express {
    interface Request {
      principal?: Principal
    }
  }
}

const TOKEN_TTL = '7d'

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return secret
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: TOKEN_TTL })
}

/** The user id inside a valid token, or null for anything else. */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, jwtSecret())
    if (typeof payload === 'object' && payload !== null && typeof payload.sub === 'string') return payload.sub
    return null
  } catch {
    return null
  }
}

function keyMatches(given: string, expected: string | undefined): boolean {
  if (!expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Express middleware: resolves `req.principal` from `x-api-key` (the CV module) or
 * `Authorization: Bearer <jwt>` (a signed-in user). Anything else is a 401.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const apiKey = req.header('x-api-key')
  if (apiKey !== undefined) {
    if (keyMatches(apiKey, process.env.CV_API_KEY)) {
      req.principal = { kind: 'service' }
      next()
    } else {
      next(new HttpError(401, 'Invalid API key'))
    }
    return
  }
  const header = req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  const userId = token ? verifyToken(token) : null
  if (!userId || !isUuid(userId)) {
    next(new HttpError(401, 'Not signed in'))
    return
  }
  req.principal = { kind: 'user', userId }
  next()
}

export function principalOf(req: Request): Principal {
  if (!req.principal) throw new HttpError(401, 'Not signed in')
  return req.principal
}

/** For routes only a signed-in person may use (creating profiles, seeding demo data). */
export function requireUser(req: Request): string {
  const p = principalOf(req)
  if (p.kind !== 'user') throw new HttpError(403, 'Sign in as a user to do this')
  return p.userId
}
