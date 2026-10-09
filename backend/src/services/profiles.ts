import { HttpError, toObjectId } from '../http.ts'
import { Profile, type ProfileShape } from '../models/Profile.ts'

/** Load a profile by route param, or fail with 404 (also for ids that are not ObjectIds). */
export async function requireProfile(id: string | undefined): Promise<ProfileShape> {
  const oid = toObjectId(id)
  const profile = oid ? await Profile.findById(oid).lean<ProfileShape>() : null
  if (!profile) throw new HttpError(404, 'Profile not found')
  return profile
}
