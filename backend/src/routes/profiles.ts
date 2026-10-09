import { CreateProfileSchema } from '@ptg/dependencies'
import { Router } from 'express'
import { validate } from '../http.ts'
import { Profile, toProfileDto, type ProfileShape } from '../models/Profile.ts'
import { requireProfile } from '../services/profiles.ts'

export const profilesRouter = Router()

profilesRouter.get('/', async (_req, res) => {
  const profiles = await Profile.find().sort({ createdAt: -1, _id: -1 }).lean<ProfileShape[]>()
  res.json(profiles.map(toProfileDto))
})

profilesRouter.post('/', async (req, res) => {
  const input = validate(CreateProfileSchema, req.body)
  const profile = await Profile.create({ ...input, createdAt: Date.now() })
  res.status(201).json(toProfileDto(profile))
})

profilesRouter.get('/:id', async (req, res) => {
  res.json(toProfileDto(await requireProfile(req.params.id)))
})
