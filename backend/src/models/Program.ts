import { EXERCISE_IDS, MUSCLE_IDS, PROGRAM_SOURCES, type ProgramDay, type ProgramDto, type ProgramItem, type ProgramSource } from '@arc/dependencies'
import { model, Schema, type Types } from 'mongoose'

export interface ProgramShape {
  _id: Types.ObjectId
  profileId: Types.ObjectId
  summary: string
  days: ProgramDay[]
  source: ProgramSource
  active: boolean
  createdAt: number
}

const ItemSchema = new Schema<ProgramItem>(
  {
    exercise: { type: String, enum: [...EXERCISE_IDS], required: true },
    muscle: { type: String, enum: [...MUSCLE_IDS] },
    side: { type: String, enum: ['left', 'right'], required: true },
    sets: { type: Number, required: true },
    reps: { type: Number, required: true },
    restSeconds: { type: Number, required: true },
    targetDeg: { type: Number, required: true },
  },
  { _id: false },
)

const DaySchema = new Schema<ProgramDay>(
  {
    weekday: { type: Number, required: true, min: 0, max: 6 },
    title: { type: String, required: true, maxlength: 60 },
    items: { type: [ItemSchema], required: true },
  },
  { _id: false },
)

/** The member's week (ADR-0020). Like plans, a new one deactivates the last and history is kept. */
const ProgramSchema = new Schema<ProgramShape>({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  summary: { type: String, required: true, maxlength: 800 },
  days: { type: [DaySchema], required: true },
  source: { type: String, enum: [...PROGRAM_SOURCES], required: true },
  active: { type: Boolean, required: true, default: true, index: true },
  createdAt: { type: Number, required: true },
})

export const Program = model<ProgramShape>('Program', ProgramSchema)

export function toProgramDto(p: ProgramShape): ProgramDto {
  return {
    id: p._id.toString(),
    profileId: p.profileId.toString(),
    summary: p.summary,
    days: p.days.map((d) => ({
      weekday: d.weekday,
      title: d.title,
      items: d.items.map(({ exercise, side, sets, reps, restSeconds, targetDeg, muscle }) => ({ exercise, side, sets, reps, restSeconds, targetDeg, ...(muscle ? { muscle } : {}) })),
    })),
    source: p.source,
    active: p.active,
    createdAt: p.createdAt,
  }
}
