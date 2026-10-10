import type { CoachMessageDto, CoachMessageKind } from '@arc/dependencies'
import { model, Schema, type Types } from 'mongoose'

/**
 * Everything Arc says, and everything said to Arc in the onboarding chat: kept per account so a
 * member's goals, their set-by-set feedback and every session read can be compared later.
 */
export interface CoachMessageShape {
  _id: Types.ObjectId
  ownerId: Types.ObjectId
  profileId?: Types.ObjectId | null
  sessionId?: Types.ObjectId | null
  kind: CoachMessageKind
  role: 'arc' | 'user'
  text: string
  /** True when Gemini was off and the line came from Arc's script or template. */
  offline: boolean
  createdAt: number
}

const CoachMessageSchema = new Schema<CoachMessageShape>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile' },
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
  kind: { type: String, enum: ['onboarding', 'set', 'session', 'ask'], required: true },
  role: { type: String, enum: ['arc', 'user'], required: true },
  text: { type: String, required: true, maxlength: 4000 },
  offline: { type: Boolean, required: true, default: false },
  createdAt: { type: Number, required: true },
})
CoachMessageSchema.index({ ownerId: 1, kind: 1, createdAt: -1 })

export const CoachMessage = model<CoachMessageShape>('CoachMessage', CoachMessageSchema)

export function toCoachMessageDto(m: CoachMessageShape): CoachMessageDto {
  const dto: CoachMessageDto = { id: m._id.toString(), kind: m.kind, text: m.text, createdAt: m.createdAt, offline: m.offline }
  if (m.profileId) dto.profileId = m.profileId.toString()
  if (m.sessionId) dto.sessionId = m.sessionId.toString()
  return dto
}
