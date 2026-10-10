import { db } from '../db.ts'
import { countSessions, insertSession } from '../store/sessions.ts'
import { generateDemoSessions } from './demoData.ts'

export const DEMO_PROFILE_NAME = 'Demo Profile'

export interface SeedResult {
  profileId: string
  sessions: number
  created: boolean
}

interface IdRow {
  id: string
}

/** Creates the account's demo profile, its plan and weeks of demo sessions. Idempotent per account. */
export async function seedDemoData(ownerId: string, now = Date.now()): Promise<SeedResult> {
  const database = db()
  const [existing] = await database.query<IdRow>('select id from profiles where owner_id = $1 and name = $2 limit 1', [ownerId, DEMO_PROFILE_NAME])
  if (existing) return { profileId: existing.id, sessions: await countSessions(database, existing.id), created: false }

  return database.transaction(async (tx) => {
    const [profile] = await tx.query<IdRow>(
      'insert into profiles (owner_id, name, notes, created_at) values ($1, $2, $3, to_timestamp($4::float8 / 1000.0)) returning id',
      [ownerId, DEMO_PROFILE_NAME, 'Seeded demo data', now],
    )
    const profileId = profile!.id
    await tx.query(
      `insert into plans (profile_id, exercise, side, sets, reps, rest_seconds, target_deg, active, created_at)
       values ($1, 'elbow_flexion', 'right', 3, 8, 45, 140, true, to_timestamp($2::float8 / 1000.0))`,
      [profileId, now],
    )
    const sessions = generateDemoSessions(profileId, now)
    for (const s of sessions) await insertSession(tx, s)
    return { profileId, sessions: sessions.length, created: true }
  })
}
