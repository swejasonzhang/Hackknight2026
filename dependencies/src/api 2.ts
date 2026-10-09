/**
 * API contract between client and server: zod schemas for request bodies (the server
 * validates with them; the client gets the types for free) and the response DTO shapes.
 */
import { z } from 'zod'
import type { ExerciseId, SessionPlan, SessionRecord, Side } from './engine/types.ts'

export const ExerciseIdSchema = z.enum(['elbow_flexion', 'shoulder_abduction', 'seated_knee_extension'])
export const SideSchema = z.enum(['left', 'right'])

// ---- accounts ----

export const SignupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(200),
})
export type SignupInput = z.infer<typeof SignupSchema>

export const LoginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
})
export type LoginInput = z.infer<typeof LoginSchema>

export interface UserDto {
  id: string
  name: string
  email: string
  createdAt: number
}

/** Returned by signup and login. Send the token as `Authorization: Bearer <token>`. */
export interface AuthResponse {
  token: string
  user: UserDto
}

// ---- profiles, plans, sessions ----

export const CreateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().optional(),
  notes: z.string().max(500).optional(),
})
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>

export const PlanInputSchema = z.object({
  exercise: ExerciseIdSchema,
  side: SideSchema,
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(50),
  restSeconds: z.number().int().min(10).max(600),
  targetDeg: z.number().min(0).max(180),
})
export type PlanInput = z.infer<typeof PlanInputSchema>

export const UpdatePlanSchema = PlanInputSchema.partial()
export type UpdatePlanInput = z.infer<typeof UpdatePlanSchema>

const epochMs = z.number().int().nonnegative()

export const RepRecordSchema = z.object({
  index: z.number().int().min(1),
  peakDeg: z.number().min(-360).max(360),
  startedAt: epochMs,
  endedAt: epochMs,
  durationMs: z.number().nonnegative(),
})

export const FatigueEstimateSchema = z.object({
  index: z.number().min(0).max(1),
  romDecay: z.number(),
  tempoDrift: z.number(),
  romDropDeg: z.number(),
  sampleReps: z.number().int().nonnegative(),
})

export const SetRecordSchema = z.object({
  setNumber: z.number().int().min(1),
  reps: z.array(RepRecordSchema),
  fatigue: FatigueEstimateSchema,
  startedAt: epochMs,
  endedAt: epochMs,
  endedEarly: z.boolean(),
})

export const SessionPlanSchema = z.object({
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(50),
  restSeconds: z.number().int().min(0).max(600),
  targetDeg: z.number().min(0).max(180),
})

/** Body for POST /api/sessions. The server recomputes fatigue and the summary; it never trusts them. */
export const CreateSessionSchema = z.object({
  profileId: z.string().min(1),
  exercise: ExerciseIdSchema,
  side: SideSchema,
  startedAt: epochMs,
  endedAt: epochMs,
  plan: SessionPlanSchema,
  sets: z.array(SetRecordSchema).min(1),
  demo: z.boolean().optional(),
}).refine((s) => s.endedAt >= s.startedAt, { message: 'endedAt must not be before startedAt', path: ['endedAt'] })
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>

export interface ProfileDto {
  id: string
  /** Account that owns this profile */
  ownerId: string
  name: string
  email?: string
  notes?: string
  createdAt: number
}

export interface PlanDto extends SessionPlan {
  id: string
  profileId: string
  exercise: ExerciseId
  side: Side
  active: boolean
  createdAt: number
}

export type SessionDto = SessionRecord

export interface ProgressPoint {
  sessionId: string
  /** ms since epoch, session start */
  date: number
  bestPeakDeg: number
  meanPeakDeg: number
  fatigueIndex: number
  totalReps: number
  demo: boolean
}

export interface WeekCount {
  /** ISO date (Monday) of the week */
  weekStart: string
  count: number
}

export interface RepPoint {
  /** e.g. "S1 R3" */
  label: string
  setNumber: number
  index: number
  peakDeg: number
}

/** GET /api/profiles/:id/progress?exercise= */
export interface ProgressDto {
  profileId: string
  exercise: ExerciseId
  /** Goal from the active plan for this exercise, if any */
  targetDeg: number | null
  /** Oldest first */
  sessions: ProgressPoint[]
  sessionsPerWeek: WeekCount[]
  /** Per-rep peaks of the most recent session */
  latestSessionReps: RepPoint[]
}

export interface ApiError {
  error: string
  issues?: unknown
}
