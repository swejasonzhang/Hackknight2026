import { PlanInputSchema, UpdatePlanSchema } from '@ptg/dependencies'
import { Router } from 'express'
import { HttpError, validate } from '../http.ts'
import { Plan, toPlanDto, type PlanShape } from '../models/Plan.ts'
import { requireProfile } from '../services/profiles.ts'

/** Mounted at /api/profiles */
export const plansRouter = Router()

plansRouter.get('/:id/plan', async (req, res) => {
  const profile = await requireProfile(req.params.id)
  const plan = await Plan.findOne({ profileId: profile._id, active: true }).lean<PlanShape>()
  if (!plan) throw new HttpError(404, 'No active plan')
  res.json(toPlanDto(plan))
})

plansRouter.get('/:id/plans', async (req, res) => {
  const profile = await requireProfile(req.params.id)
  const plans = await Plan.find({ profileId: profile._id }).sort({ createdAt: -1, _id: -1 }).lean<PlanShape[]>()
  res.json(plans.map(toPlanDto))
})

plansRouter.put('/:id/plan', async (req, res) => {
  const input = validate(PlanInputSchema, req.body)
  const profile = await requireProfile(req.params.id)
  await Plan.updateMany({ profileId: profile._id, active: true }, { $set: { active: false } })
  const plan = await Plan.create({ ...input, profileId: profile._id, active: true, createdAt: Date.now() })
  res.status(201).json(toPlanDto(plan))
})

plansRouter.patch('/:id/plan', async (req, res) => {
  const input = validate(UpdatePlanSchema, req.body)
  const profile = await requireProfile(req.params.id)
  const plan = await Plan.findOneAndUpdate(
    { profileId: profile._id, active: true },
    { $set: input },
    { new: true, runValidators: true },
  ).lean<PlanShape>()
  if (!plan) throw new HttpError(404, 'No active plan')
  res.json(toPlanDto(plan))
})
