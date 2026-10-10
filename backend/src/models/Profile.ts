import { EXERCISE_IDS, type CoachIntake, type ProfileDto } from '@arc/dependencies'
import { model, Schema, type Types } from 'mongoose'

export interface ProfileShape {
  _id: Types.ObjectId
  ownerId: Types.ObjectId
  name: string
  email?: string | null
  notes?: string | null
  /** What Arc learned in the onboarding chat. */
  intake?: CoachIntake | null
  createdAt: number
}

const IntakeSchema = new Schema<CoachIntake>(
  {
    goals: { type: String, required: true, maxlength: 500 },
    focus: { type: String, enum: [...EXERCISE_IDS], required: true },
    side: { type: String, enum: ['left', 'right'], required: true },
    limitations: { type: String, maxlength: 500, default: '' },
    experience: { type: String, enum: ['new', 'some', 'regular'], required: true },
    daysPerWeek: { type: Number, required: true, min: 1, max: 7 },
  },
  { _id: false },
)

const ProfileSchema = new Schema<ProfileShape>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, trim: true },
  notes: { type: String, maxlength: 500 },
  intake: { type: IntakeSchema },
  createdAt: { type: Number, required: true },
})

export const Profile = model<ProfileShape>('Profile', ProfileSchema)

export function toProfileDto(p: ProfileShape): ProfileDto {
  const dto: ProfileDto = { id: p._id.toString(), ownerId: p.ownerId.toString(), name: p.name, createdAt: p.createdAt }
  if (p.email) dto.email = p.email
  if (p.notes) dto.notes = p.notes
  if (p.intake) {
    const { goals, focus, side, limitations, experience, daysPerWeek } = p.intake
    dto.intake = { goals, focus, side, limitations: limitations ?? '', experience, daysPerWeek }
  }
  return dto
}
