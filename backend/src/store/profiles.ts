import type { CreateProfileInput, ProfileDto } from '@arc/dependencies'
import type { Principal } from '../auth.ts'
import { db, type Queryable } from '../db.ts'
import { HttpError } from '../http.ts'
import { isUuid, ms } from '../sql.ts'

export interface ProfileRow {
  id: string
  owner_id: string
  name: string
  email: string | null
  notes: string | null
  created_at: number
}

const COLS = `id, owner_id, name, email, notes, ${ms('created_at')} as created_at`

/** SQL limiting a query to what the caller may see: their own profiles, or everything for the CV service. */
function visibleTo(principal: Principal, column = 'owner_id'): { clause: string; params: unknown[] } {
  return principal.kind === 'user' ? { clause: `${column} = $1`, params: [principal.userId] } : { clause: 'true', params: [] }
}

export async function listProfiles(q: Queryable, principal: Principal): Promise<ProfileRow[]> {
  const v = visibleTo(principal)
  return q.query<ProfileRow>(`select ${COLS} from profiles where ${v.clause} order by created_at desc, seq desc`, v.params)
}

export async function createProfile(q: Queryable, ownerId: string, input: CreateProfileInput, createdAt?: number): Promise<ProfileRow> {
  const [row] = await q.query<ProfileRow>(
    `insert into profiles (owner_id, name, email, notes, created_at) values ($1, $2, $3, $4, coalesce(to_timestamp($5::float8 / 1000.0), clock_timestamp())) returning ${COLS}`,
    [ownerId, input.name, input.email ?? null, input.notes ?? null, createdAt ?? null],
  )
  return row!
}

export async function findProfile(q: Queryable, id: string | undefined, principal: Principal): Promise<ProfileRow | null> {
  if (!isUuid(id)) return null
  const v = visibleTo(principal)
  const params = [...v.params, id]
  const [row] = await q.query<ProfileRow>(`select ${COLS} from profiles where ${v.clause} and id = $${params.length}`, params)
  return row ?? null
}

/** Removes the profile; plans, sessions, sets and reps follow through the foreign keys. */
export async function deleteProfile(q: Queryable, id: string): Promise<void> {
  await q.query('delete from profiles where id = $1', [id])
}

/**
 * Load a profile the caller may access, or fail with 404. A profile owned by someone
 * else is indistinguishable from a missing one. The CV service may access any profile.
 */
export async function requireProfile(id: string | undefined, principal: Principal): Promise<ProfileRow> {
  const profile = await findProfile(db(), id, principal)
  if (!profile) throw new HttpError(404, 'Profile not found')
  return profile
}

export function toProfileDto(p: ProfileRow): ProfileDto {
  const dto: ProfileDto = { id: p.id, ownerId: p.owner_id, name: p.name, createdAt: Math.round(p.created_at) }
  if (p.email) dto.email = p.email
  if (p.notes) dto.notes = p.notes
  return dto
}
