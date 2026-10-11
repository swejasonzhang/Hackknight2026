import { CreateProfileSchema, UpdateProfileSchema } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf, requireUser } from '../auth.ts'
import { HttpError, validate } from '../http.ts'
import { Plan } from '../models/Plan.ts'
import { Program } from '../models/Program.ts'
import { Profile, toProfileDto, type ProfileShape } from '../models/Profile.ts'
import { Session } from '../models/Session.ts'
import { ownerFilter, requireProfile } from '../services/profiles.ts'

/** Mounted at /api/profiles (behind `authenticate`) */
export const profilesRouter = Router()

profilesRouter.get('/', async (req, res) => {
  const profiles = await Profile.find(ownerFilter(principalOf(req))).sort({ createdAt: -1, _id: -1 }).lean<ProfileShape[]>()
  res.json(profiles.map(toProfileDto))
})

profilesRouter.post('/', async (req, res) => {
  const ownerId = requireUser(req)
  const input = validate(CreateProfileSchema, req.body)
  const profile = await Profile.create({ ...input, ownerId, createdAt: Date.now() })
  res.status(201).json(toProfileDto(profile))
})

profilesRouter.get('/:id', async (req, res) => {
  res.json(toProfileDto(await requireProfile(req.params.id, principalOf(req))))
})

/**
 * Which body the profile's figure is drawn as; null clears it. Members only, and only their own
 * profiles: the camera app reads profiles but never changes them.
 */
profilesRouter.patch('/:id', async (req, res) => {
  requireUser(req)
  const { figure } = validate(UpdateProfileSchema, req.body)
  const existing = await requireProfile(req.params.id, principalOf(req))
  const profile = await Profile.findByIdAndUpdate(existing._id, figure ? { $set: { figure } } : { $unset: { figure: 1 } }, { returnDocument: 'after', runValidators: true }).lean<ProfileShape>()
  // Deleted in another tab between the two queries.
  if (!profile) throw new HttpError(404, 'Profile not found')
  res.json(toProfileDto(profile))
})

profilesRouter.delete('/:id', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  await Promise.all([
    Session.deleteMany({ profileId: profile._id }),
    Plan.deleteMany({ profileId: profile._id }),
    Program.deleteMany({ profileId: profile._id }),
    Profile.deleteOne({ _id: profile._id }),
  ])
  res.status(204).end()
})
