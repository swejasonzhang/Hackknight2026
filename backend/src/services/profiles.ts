import type { Principal } from '../auth.ts'
import { HttpError, toObjectId } from '../http.ts'
import { Profile, type ProfileShape } from '../models/Profile.ts'

/** Mongo filter limiting a query to what the caller may see. */
export function ownerFilter(principal: Principal): Record<string, unknown> {
  return principal.kind === 'user' ? { ownerId: principal.userId } : {}
}

/**
 * Load a profile the caller may access, or fail with 404. A profile owned by someone
 * else is indistinguishable from a missing one. The CV service may access any profile.
 */
export async function requireProfile(id: string | undefined, principal: Principal): Promise<ProfileShape> {
  const oid = toObjectId(id)
  const profile = oid ? await Profile.findOne({ _id: oid, ...ownerFilter(principal) }).lean<ProfileShape>() : null
  if (!profile) throw new HttpError(404, 'Profile not found')
  return profile
}
