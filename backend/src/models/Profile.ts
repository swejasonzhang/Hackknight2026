import type { ProfileDto } from '@ptg/dependencies'
import { model, Schema, type Types } from 'mongoose'

export interface ProfileShape {
  _id: Types.ObjectId
  name: string
  email?: string | null
  notes?: string | null
  createdAt: number
}

const ProfileSchema = new Schema<ProfileShape>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, trim: true },
  notes: { type: String, maxlength: 500 },
  createdAt: { type: Number, required: true },
})

export const Profile = model<ProfileShape>('Profile', ProfileSchema)

export function toProfileDto(p: ProfileShape): ProfileDto {
  const dto: ProfileDto = { id: p._id.toString(), name: p.name, createdAt: p.createdAt }
  if (p.email) dto.email = p.email
  if (p.notes) dto.notes = p.notes
  return dto
}
