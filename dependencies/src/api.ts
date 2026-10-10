/**
 * API contract between client and server: zod schemas for request bodies (the server
 * validates with them; the client gets the types for free) and the response DTO shapes.
 */
import { z } from 'zod'
import { EmailSchema, NameSchema } from './fields.ts'
import type { CatalogGroup } from './engine/exercises.ts'
import type { ProgramDto } from './program.ts'
import { EXERCISE_IDS, MUSCLE_IDS, VOICE_COMMANDS, type ExerciseId, type SessionPlan, type SessionRecord, type Side } from './engine/types.ts'

export const ExerciseIdSchema = z.enum(EXERCISE_IDS)
export const SideSchema = z.enum(['left', 'right'])
export const MuscleIdSchema = z.enum(MUSCLE_IDS)

// ---- accounts ----

export const SignupSchema = z.object({
  name: NameSchema,
  email: EmailSchema.transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(200),
})
export type SignupInput = z.infer<typeof SignupSchema>

export const LoginSchema = z.object({
  email: EmailSchema.transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
})
export type LoginInput = z.infer<typeof LoginSchema>

/** What deleting an account takes: the account's own email and password, and DELETE typed out. */
export const DELETE_CONFIRMATION = 'DELETE'
export const DeleteAccountSchema = z.object({
  email: EmailSchema.transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
  confirm: z.literal(DELETE_CONFIRMATION),
})
export type DeleteAccountInput = z.input<typeof DeleteAccountSchema>

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
  name: NameSchema,
  email: EmailSchema.optional(),
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

/** Body of POST /api/dev/seed: the browser's `Date#getTimezoneOffset()`, so demo sessions land at local hours. */
export const SeedRequestSchema = z
  .object({ tzOffsetMinutes: z.number().int().min(-840).max(840).optional() })
  .optional()
export type SeedRequest = z.infer<typeof SeedRequestSchema>

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
export const SessionEventSchema = z.object({ at: epochMs, command: z.enum(VOICE_COMMANDS) })
export const CreateSessionSchema = z.object({
  profileId: z.string().min(1),
  exercise: ExerciseIdSchema,
  side: SideSchema,
  startedAt: epochMs,
  endedAt: epochMs,
  plan: SessionPlanSchema,
  sets: z.array(SetRecordSchema).min(1),
  demo: z.boolean().optional(),
  /** Voice commands given while recording (hands-free). */
  events: z.array(SessionEventSchema).max(500).optional(),
  /** False while the browser saves a recording set by set; absent or true for a finished session. */
  complete: z.boolean().optional(),
  /** The weight held, in kilograms (0 for bodyweight); absent when not given. */
  loadKg: z.number().min(0).max(500).optional(),
}).refine((s) => s.endedAt >= s.startedAt, { message: 'endedAt must not be before startedAt', path: ['endedAt'] })
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>

export interface ProfileDto {
  id: string
  /** Account that owns this profile */
  ownerId: string
  name: string
  email?: string
  notes?: string
  /** What Arc learned in the onboarding chat. */
  intake?: CoachIntake
  createdAt: number
}

// ---- Arc, the coach (Gemini for words, ElevenLabs for voice) ----

/** The coach is always called Arc. */
export const COACH_NAME = 'Arc'

/** What Arc asks about, in order. The page shows a lamp per topic and quick replies for the current one. */
export const ONBOARDING_TOPICS = ['goals', 'trainingGoal', 'focus', 'side', 'limitations', 'experience', 'days', 'height', 'weight'] as const
export type OnboardingTopic = (typeof ONBOARDING_TOPICS)[number]

/** One line of the chat; Arc's lines carry the topic they asked, so each answer is read for its question. */
export const ChatTurnSchema = z.object({ role: z.enum(['arc', 'user']), text: z.string().trim().min(1).max(2000), topic: z.enum(ONBOARDING_TOPICS).optional() })
export type ChatTurn = z.infer<typeof ChatTurnSchema>

/** One onboarding turn: the conversation so far, and the profile to fill (else Arc creates one). */
export const OnboardingInputSchema = z.object({
  messages: z.array(ChatTurnSchema).max(40),
  profileId: z.string().min(1).optional(),
  /** Skip the rest: build the week now from what has been said, with defaults for the rest. */
  finish: z.boolean().optional(),
})
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>

export const ExperienceSchema = z.enum(['new', 'some', 'regular'])
/** The ai-coach module's three training goals: strength, muscle size (hypertrophy) and stamina. */
export const TRAINING_GOALS = ['strength', 'hypertrophy', 'endurance'] as const
export const TrainingGoalSchema = z.enum(TRAINING_GOALS)
export type TrainingGoal = z.infer<typeof TrainingGoalSchema>
/** A day of the week as `Date#getDay` counts it: 0 is Sunday, 6 is Saturday. */
export const WeekdaySchema = z.number().int().min(0).max(6)

/** What Arc learns from the onboarding chat, saved on the profile and used in every later read. */
export const CoachIntakeSchema = z.object({
  goals: z.string().trim().min(1).max(500),
  focus: ExerciseIdSchema,
  side: SideSchema,
  limitations: z.string().trim().max(500),
  experience: ExperienceSchema,
  daysPerWeek: z.number().int().min(1).max(7),
  /** Added with the ai-coach survey; profiles from before it have none of these. */
  trainingGoal: TrainingGoalSchema.optional(),
  trainingDays: z.array(WeekdaySchema).min(1).max(7).optional(),
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(25).max(350).optional(),
})
export type CoachIntake = z.infer<typeof CoachIntakeSchema>


export interface OnboardingReply {
  /** Arc's next line. */
  reply: string
  messageId: string
  /** True once Arc has what it needs: the profile, the plan and the week are saved. */
  done: boolean
  /** True when Gemini is not configured and Arc follows its scripted questions. */
  offline: boolean
  /** What Arc's line asks about; absent once Arc is done. */
  topic?: OnboardingTopic
  /** With the "where to start" question: every movement Arc can track, by body area. */
  choices?: CatalogGroup[]
  intake?: CoachIntake
  profileId?: string
  plan?: PlanDto
  /** The week Arc built from the answers. */
  program?: ProgramDto
}

/** Arc's read for the rest after a set (the set itself is already saved by then). */
export const SetFeedbackInputSchema = z.object({
  profileId: z.string().min(1),
  exercise: ExerciseIdSchema,
  side: SideSchema,
  plan: SessionPlanSchema,
  setNumber: z.number().int().min(1),
  reps: z.array(RepRecordSchema).max(100),
})
export type SetFeedbackInput = z.infer<typeof SetFeedbackInputSchema>

export type CoachMessageKind = 'onboarding' | 'set' | 'session' | 'ask'

/** A short line for Arc to say aloud (acknowledgements, cues during a set). */
export const SpeakInputSchema = z.object({ text: z.string().trim().min(1).max(240) })
export type SpeakInput = z.infer<typeof SpeakInputSchema>

/** Where the member is in the workout when they speak to Arc. */
export const LiveContextSchema = z.object({
  setNumber: z.number().int().min(1).max(20),
  setsPlanned: z.number().int().min(1).max(20),
  repsInSet: z.number().int().min(0).max(100),
  repsPlanned: z.number().int().min(1).max(100),
  totalReps: z.number().int().min(0).max(1000),
  recentPeaks: z.array(z.number().min(-360).max(360)).max(12),
  bestDeg: z.number().min(-360).max(360).nullable(),
  targetDeg: z.number().min(0).max(180),
  phase: z.enum(['waiting', 'active', 'rest', 'done']),
})
export type LiveContext = z.infer<typeof LiveContextSchema>

/** Something the member said to Arc while recording: a question, a feeling, feedback. */
export const AskInputSchema = z.object({
  profileId: z.string().min(1),
  exercise: ExerciseIdSchema,
  side: SideSchema,
  text: z.string().trim().min(1).max(500),
  live: LiveContextSchema,
})
export type AskInput = z.infer<typeof AskInputSchema>
export interface CoachMessageDto {
  id: string
  kind: CoachMessageKind
  text: string
  createdAt: number
  offline: boolean
  profileId?: string
  sessionId?: string
}

/** Which of Arc's services are configured on the server. */
export interface CoachStatus {
  gemini: boolean
  voice: boolean
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
