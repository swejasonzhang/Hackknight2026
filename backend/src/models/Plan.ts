import { EXERCISE_IDS, type ExerciseId, type PlanDto, type Side } from '@ptg/dependencies'
import { model, Schema, type Types } from 'mongoose'

export interface PlanShape {
  _id: Types.ObjectId
  profileId: Types.ObjectId
  exercise: ExerciseId
  side: Side
  sets: number
  reps: number
  restSeconds: number
  targetDeg: number
  active: boolean
  createdAt: number
}

const PlanSchema = new Schema<PlanShape>({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  exercise: { type: String, enum: [...EXERCISE_IDS], required: true },
  side: { type: String, enum: ['left', 'right'], required: true },
  sets: { type: Number, required: true },
  reps: { type: Number, required: true },
  restSeconds: { type: Number, required: true },
  targetDeg: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true, index: true },
  createdAt: { type: Number, required: true },
})

export const Plan = model<PlanShape>('Plan', PlanSchema)

export function toPlanDto(p: PlanShape): PlanDto {
  const dto: PlanDto = {
    id: p._id.toString(),
    profileId: p.profileId.toString(),
    exercise: p.exercise,
    side: p.side,
    sets: p.sets,
    reps: p.reps,
    restSeconds: p.restSeconds,
    targetDeg: p.targetDeg,
    active: p.active,
    createdAt: p.createdAt,
  }
  return dto
}
