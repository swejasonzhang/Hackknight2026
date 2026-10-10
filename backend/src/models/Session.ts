import {
  EXERCISE_IDS,
  VOICE_COMMANDS,
  type CoachSummary,
  type ExerciseId,
  type SessionEvent,
  type SessionDto,
  type SessionPlan,
  type SessionSummary,
  type SetRecord,
  type Side,
} from '@arc/dependencies'
import { model, Schema, type Types } from 'mongoose'

export interface SessionShape {
  _id: Types.ObjectId
  profileId: Types.ObjectId
  exercise: ExerciseId
  side: Side
  startedAt: number
  endedAt: number
  plan: SessionPlan
  sets: SetRecord[]
  summary: SessionSummary
  demo: boolean
  events?: SessionEvent[]
  coachSummary?: CoachSummary | null
  complete?: boolean
}

const RepSchema = new Schema(
  {
    index: { type: Number, required: true },
    peakDeg: { type: Number, required: true },
    startedAt: { type: Number, required: true },
    endedAt: { type: Number, required: true },
    durationMs: { type: Number, required: true },
  },
  { _id: false },
)

const FatigueSchema = new Schema(
  {
    index: { type: Number, required: true },
    romDecay: { type: Number, required: true },
    tempoDrift: { type: Number, required: true },
    romDropDeg: { type: Number, required: true },
    sampleReps: { type: Number, required: true },
  },
  { _id: false },
)

const SetSchema = new Schema(
  {
    setNumber: { type: Number, required: true },
    reps: { type: [RepSchema], required: true },
    fatigue: { type: FatigueSchema, required: true },
    startedAt: { type: Number, required: true },
    endedAt: { type: Number, required: true },
    endedEarly: { type: Boolean, required: true },
  },
  { _id: false },
)

const PlanSnapshotSchema = new Schema(
  {
    sets: { type: Number, required: true },
    reps: { type: Number, required: true },
    restSeconds: { type: Number, required: true },
    targetDeg: { type: Number, required: true },
  },
  { _id: false },
)

const SummarySchema = new Schema(
  {
    totalReps: { type: Number, required: true },
    bestPeakDeg: { type: Number, required: true },
    meanPeakDeg: { type: Number, required: true },
    fatigueIndex: { type: Number, required: true },
  },
  { _id: false },
)

const EventSchema = new Schema<SessionEvent>(
  {
    at: { type: Number, required: true },
    command: { type: String, enum: [...VOICE_COMMANDS], required: true },
  },
  { _id: false },
)

const CoachSummarySchema = new Schema<CoachSummary>(
  {
    text: { type: String, required: true, maxlength: 4000 },
    messageId: { type: String, required: true },
    createdAt: { type: Number, required: true },
    offline: { type: Boolean, required: true },
  },
  { _id: false },
)

const SessionSchema = new Schema<SessionShape>({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  exercise: { type: String, enum: [...EXERCISE_IDS], required: true },
  side: { type: String, enum: ['left', 'right'], required: true },
  startedAt: { type: Number, required: true },
  endedAt: { type: Number, required: true },
  plan: { type: PlanSnapshotSchema, required: true },
  sets: { type: [SetSchema], required: true },
  summary: { type: SummarySchema, required: true },
  demo: { type: Boolean, required: true, default: false },
  events: { type: [EventSchema], default: undefined },
  coachSummary: { type: CoachSummarySchema },
  /** False while a recording is saved set by set; sessions from before this field are complete. */
  complete: { type: Boolean, default: true },
})
SessionSchema.index({ profileId: 1, startedAt: -1 })
SessionSchema.index({ profileId: 1, exercise: 1, startedAt: 1 })

export const Session = model<SessionShape>('Session', SessionSchema)

/** Plain DTO with no Mongoose internals, safe to send and to feed back into the engine. */
export function toSessionDto(s: SessionShape): SessionDto {
  return {
    id: s._id.toString(),
    profileId: s.profileId.toString(),
    exercise: s.exercise,
    side: s.side,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    plan: { sets: s.plan.sets, reps: s.plan.reps, restSeconds: s.plan.restSeconds, targetDeg: s.plan.targetDeg },
    sets: s.sets.map((set) => ({
      setNumber: set.setNumber,
      reps: set.reps.map((r) => ({
        index: r.index,
        peakDeg: r.peakDeg,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        durationMs: r.durationMs,
      })),
      fatigue: {
        index: set.fatigue.index,
        romDecay: set.fatigue.romDecay,
        tempoDrift: set.fatigue.tempoDrift,
        romDropDeg: set.fatigue.romDropDeg,
        sampleReps: set.fatigue.sampleReps,
      },
      startedAt: set.startedAt,
      endedAt: set.endedAt,
      endedEarly: set.endedEarly,
    })),
    summary: {
      totalReps: s.summary.totalReps,
      bestPeakDeg: s.summary.bestPeakDeg,
      meanPeakDeg: s.summary.meanPeakDeg,
      fatigueIndex: s.summary.fatigueIndex,
    },
    demo: s.demo,
    complete: s.complete !== false,
    ...(s.events?.length ? { events: s.events.map((e) => ({ at: e.at, command: e.command })) } : {}),
    ...(s.coachSummary ? { coachSummary: { text: s.coachSummary.text, messageId: s.coachSummary.messageId, createdAt: s.coachSummary.createdAt, offline: s.coachSummary.offline } } : {}),
  }
}
