import { CreateProfileSchema } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf, requireUser } from '../auth.ts'
import { validate } from '../http.ts'
import { Plan } from '../models/Plan.ts'
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

profilesRouter.delete('/:id', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  await Promise.all([
    Session.deleteMany({ profileId: profile._id }),
    Plan.deleteMany({ profileId: profile._id }),
    Profile.deleteOne({ _id: profile._id }),
  ])
  res.status(204).end()
})
