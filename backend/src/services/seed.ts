import { randomInt } from 'node:crypto'
import type { Types } from 'mongoose'
import { Plan } from '../models/Plan.ts'
import { Profile } from '../models/Profile.ts'
import { Program } from '../models/Program.ts'
import { Session } from '../models/Session.ts'
import { generateDemoSessions, programFromIntake } from '@arc/dependencies'

export const DEMO_PROFILE_NAME = 'Demo Profile'

export interface SeedResult {
  profileId: string
  sessions: number
  created: boolean
}

export interface SeedOptions {
  now?: number
  /** A fresh random seed per account unless one is given, so no two demo dashboards look alike. */
  seed?: number
  /** The caller's `Date#getTimezoneOffset()`, so sessions land at their local training hours. */
  tzOffsetMinutes?: number
}

/**
 * Creates the account's demo profile, its plan, a Monday-Wednesday-Friday week for the calendar
 * and six weeks of random demo sessions.
 * Idempotent per account.
 */
export async function seedDemoData(ownerId: Types.ObjectId, { now = Date.now(), seed = randomInt(0, 2 ** 31 - 1), tzOffsetMinutes = 0 }: SeedOptions = {}): Promise<SeedResult> {
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
  const week = programFromIntake({ goals: 'Demo', focus: 'elbow_flexion', side: 'right', limitations: 'none', experience: 'some', daysPerWeek: 3, trainingGoal: 'hypertrophy', trainingDays: [1, 3, 5] })
  await Program.create({ ...week, source: 'demo', profileId: profile._id, active: true, createdAt: now })
  const docs = generateDemoSessions(profile._id.toString(), now, seed, tzOffsetMinutes).map((s) => ({ ...s, profileId: profile._id }))
  await Session.insertMany(docs)
  return { profileId: profile._id.toString(), sessions: docs.length, created: true }
}
