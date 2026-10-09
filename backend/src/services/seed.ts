import type { Types } from 'mongoose'
import { Plan } from '../models/Plan.ts'
import { Profile } from '../models/Profile.ts'
import { Session } from '../models/Session.ts'
import { generateDemoSessions } from './demoData.ts'

export const DEMO_PROFILE_NAME = 'Demo Profile'

export interface SeedResult {
  profileId: string
  sessions: number
  created: boolean
}

/** Creates the account's demo profile, its plan and weeks of demo sessions. Idempotent per account. */
export async function seedDemoData(ownerId: Types.ObjectId, now = Date.now()): Promise<SeedResult> {
  const existing = await Profile.findOne({ ownerId, name: DEMO_PROFILE_NAME }).lean()
  if (existing) {
    const sessions = await Session.countDocuments({ profileId: existing._id })
    return { profileId: existing._id.toString(), sessions, created: false }
  }
  const profile = await Profile.create({ ownerId, name: DEMO_PROFILE_NAME, notes: 'Seeded demo data', createdAt: now })
  await Plan.create({
    profileId: profile._id,
    exercise: 'elbow_flexion',
    side: 'right',
    sets: 3,
    reps: 8,
    restSeconds: 45,
    targetDeg: 140,
    active: true,
    createdAt: now,
  })
  const docs = generateDemoSessions(profile._id.toString(), now).map((s) => ({ ...s, profileId: profile._id }))
  await Session.insertMany(docs)
  return { profileId: profile._id.toString(), sessions: docs.length, created: true }
}
