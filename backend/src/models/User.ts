import type { UserDto } from '@arc/dependencies'
import { model, Schema, type Types } from 'mongoose'

export interface UserShape {
  _id: Types.ObjectId
  name: string
  email: string
  passwordHash: string
  createdAt: number
}

const UserSchema = new Schema<UserShape>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Number, required: true },
})

export const User = model<UserShape>('User', UserSchema)

/** Never includes the password hash. */
export function toUserDto(u: UserShape): UserDto {
  return { id: u._id.toString(), name: u.name, email: u.email, createdAt: u.createdAt }
}
