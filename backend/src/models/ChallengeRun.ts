import { CHALLENGE_IDS, CHALLENGE_STATUSES, type ChallengeId, type ChallengeRunDto, type ChallengeStatus } from '@arc/dependencies'
import { model, Schema, type Types } from 'mongoose'

export interface ChallengeRunShape {
  _id: Types.ObjectId
  profileId: Types.ObjectId
  challengeId: ChallengeId
  /** The start of the member's day it began on, ms since the epoch. */
  startedAt: number
  status: ChallengeStatus
  /** The phase whose week is in force (its index). */
  phase: number
  /** When it finished or was left. */
  endedAt?: number | null
  createdAt: number
}

/**
 * A profile's run at a challenge (challenges.ts). One is active at a time: starting another leaves
 * it, and finished and left runs are kept.
 */
const ChallengeRunSchema = new Schema<ChallengeRunShape>({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  challengeId: { type: String, enum: [...CHALLENGE_IDS], required: true },
  startedAt: { type: Number, required: true },
  status: { type: String, enum: [...CHALLENGE_STATUSES], required: true, default: 'active' },
  phase: { type: Number, required: true, default: 0, min: 0 },
  endedAt: { type: Number },
  createdAt: { type: Number, required: true },
})

export const ChallengeRun = model<ChallengeRunShape>('ChallengeRun', ChallengeRunSchema)

export function toChallengeRunDto(r: ChallengeRunShape): ChallengeRunDto {
  const dto: ChallengeRunDto = { id: r._id.toString(), profileId: r.profileId.toString(), challengeId: r.challengeId, startedAt: r.startedAt, status: r.status, phase: r.phase }
  if (r.endedAt != null) dto.endedAt = r.endedAt
  return dto
}
