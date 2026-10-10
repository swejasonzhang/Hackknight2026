import { CreateProfileSchema } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf, requireUser } from '../auth.ts'
import { db } from '../db.ts'
import { validate } from '../http.ts'
import { createProfile, deleteProfile, listProfiles, requireProfile, toProfileDto } from '../store/profiles.ts'

/** Mounted at /api/profiles (behind `authenticate`) */
export const profilesRouter = Router()

profilesRouter.get('/', async (req, res) => {
  const profiles = await listProfiles(db(), principalOf(req))
  res.json(profiles.map(toProfileDto))
})

profilesRouter.post('/', async (req, res) => {
  const ownerId = requireUser(req)
  const input = validate(CreateProfileSchema, req.body)
  const profile = await createProfile(db(), ownerId, input)
  res.status(201).json(toProfileDto(profile))
})

profilesRouter.get('/:id', async (req, res) => {
  res.json(toProfileDto(await requireProfile(req.params.id, principalOf(req))))
})

profilesRouter.delete('/:id', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  await deleteProfile(db(), profile.id)
  res.status(204).end()
})
