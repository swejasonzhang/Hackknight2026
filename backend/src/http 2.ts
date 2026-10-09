import type { ErrorRequestHandler, RequestHandler } from 'express'
import mongoose from 'mongoose'
import type { ZodType } from 'zod'

/** Thrown from route handlers; the error middleware turns it into a JSON response. */
export class HttpError extends Error {
  readonly status: number
  readonly issues: unknown

  constructor(status: number, message: string, issues?: unknown) {
    super(message)
    this.status = status
    this.issues = issues
  }
}

/** Validate a request body or query with a zod schema, or fail with 400 + issues. */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new HttpError(400, 'Invalid request', result.error.issues)
  return result.data
}

/** Parse a route param as an ObjectId, or null when it cannot be one (which callers treat as 404). */
export function toObjectId(id: string | undefined): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.isValidObjectId(id)) return null
  return new mongoose.Types.ObjectId(id)
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.issues === undefined ? { error: err.message } : { error: err.message, issues: err.issues })
    return
  }
  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }
  if (typeof err === 'object' && err !== null && 'code' in err && err.code === 11000) {
    res.status(409).json({ error: 'Already exists' })
    return
  }
  console.error('[api] unhandled error', err)
  res.status(500).json({ error: 'Internal error' })
}
