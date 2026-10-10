import { PlanInputSchema, UpdatePlanSchema } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { db } from '../db.ts'
import { HttpError, validate } from '../http.ts'
import { activePlan, listPlans, patchPlan, replacePlan, toPlanDto } from '../store/plans.ts'
import { requireProfile } from '../store/profiles.ts'

/** Mounted at /api/profiles (behind `authenticate`) */
export const plansRouter = Router()

plansRouter.get('/:id/plan', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const plan = await activePlan(db(), profile.id)
  if (!plan) throw new HttpError(404, 'No active plan')
  res.json(toPlanDto(plan))
})

plansRouter.get('/:id/plans', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  res.json((await listPlans(db(), profile.id)).map(toPlanDto))
})

plansRouter.put('/:id/plan', async (req, res) => {
  const input = validate(PlanInputSchema, req.body)
  const profile = await requireProfile(req.params.id, principalOf(req))
  res.status(201).json(toPlanDto(await replacePlan(db(), profile.id, input)))
})

plansRouter.patch('/:id/plan', async (req, res) => {
  const input = validate(UpdatePlanSchema, req.body)
  const profile = await requireProfile(req.params.id, principalOf(req))
  const plan = await patchPlan(db(), profile.id, input)
  if (!plan) throw new HttpError(404, 'No active plan')
  res.json(toPlanDto(plan))
})
