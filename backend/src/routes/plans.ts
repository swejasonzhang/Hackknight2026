import { describeWeek, goalProblem, mondayFirst, PlanInputSchema, ProgramEditSchema, UpdatePlanSchema } from '@arc/dependencies'
import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { HttpError, validate } from '../http.ts'
import { Plan, toPlanDto, type PlanShape } from '../models/Plan.ts'
import { Program, toProgramDto, type ProgramShape } from '../models/Program.ts'
import { planFromProgram } from '../services/arc.ts'
import { requireProfile } from '../services/profiles.ts'

/** Mounted at /api/profiles (behind `authenticate`) */
export const plansRouter = Router()

plansRouter.get('/:id/plan', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const plan = await Plan.findOne({ profileId: profile._id, active: true }).lean<PlanShape>()
  if (!plan) throw new HttpError(404, 'No active plan')
  res.json(toPlanDto(plan))
})

plansRouter.get('/:id/plans', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const plans = await Plan.find({ profileId: profile._id }).sort({ createdAt: -1, _id: -1 }).lean<PlanShape[]>()
  res.json(plans.map(toPlanDto))
})

plansRouter.put('/:id/plan', async (req, res) => {
  const input = validate(PlanInputSchema, req.body)
  const problem = goalProblem(input.exercise, input.targetDeg)
  if (problem) throw new HttpError(400, problem)
  const profile = await requireProfile(req.params.id, principalOf(req))
  await Plan.updateMany({ profileId: profile._id, active: true }, { $set: { active: false } })
  const plan = await Plan.create({ ...input, profileId: profile._id, active: true, createdAt: Date.now() })
  res.status(201).json(toPlanDto(plan))
})

plansRouter.patch('/:id/plan', async (req, res) => {
  const input = validate(UpdatePlanSchema, req.body)
  const profile = await requireProfile(req.params.id, principalOf(req))
  if (input.exercise != null || input.targetDeg != null) {
    const current = await Plan.findOne({ profileId: profile._id, active: true }).lean<PlanShape>()
    if (!current) throw new HttpError(404, 'No active plan')
    const problem = goalProblem(input.exercise ?? current.exercise, input.targetDeg ?? current.targetDeg)
    if (problem) throw new HttpError(400, problem)
  }
  const plan = await Plan.findOneAndUpdate(
    { profileId: profile._id, active: true },
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  ).lean<PlanShape>()
  if (!plan) throw new HttpError(404, 'No active plan')
  res.json(toPlanDto(plan))
})

/** The week Arc built (ADR-0020): which days to train and what each holds. */
plansRouter.get('/:id/program', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const program = await Program.findOne({ profileId: profile._id, active: true }).sort({ createdAt: -1, _id: -1 }).lean<ProgramShape>()
  if (!program) throw new HttpError(404, 'No program yet')
  res.json(toProgramDto(program))
})

/** Every week the profile has had, newest first: Arc's, the demo's and the member's own edits. */
plansRouter.get('/:id/programs', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  const programs = await Program.find({ profileId: profile._id }).sort({ createdAt: -1, _id: -1 }).limit(12).lean<ProgramShape[]>()
  res.json(programs.map(toProgramDto))
})

/**
 * The member's own week (ADR-0026): any days, several movements a day for the muscle groups they
 * pick, any numbers inside the schema's limits. It becomes the active week (the last is kept in
 * history), Arc writes its summary, and Record's plan follows its first movement. Members only:
 * the camera app reads weeks but never changes them.
 */
plansRouter.put('/:id/program', async (req, res) => {
  const principal = principalOf(req)
  if (principal.kind !== 'user') throw new HttpError(403, 'Only the member can change their week')
  const { days } = validate(ProgramEditSchema, req.body)
  const profile = await requireProfile(req.params.id, principal)
  const sorted = [...days].sort((a, b) => mondayFirst(a.weekday, b.weekday))
  const week = { summary: describeWeek(sorted), days: sorted }
  const now = Date.now()
  await Program.updateMany({ profileId: profile._id, active: true }, { $set: { active: false } })
  const program = await Program.create({ ...week, source: 'member', profileId: profile._id, active: true, createdAt: now })
  await Plan.updateMany({ profileId: profile._id, active: true }, { $set: { active: false } })
  await Plan.create({ ...planFromProgram(week), profileId: profile._id, active: true, createdAt: now })
  res.status(201).json(toProgramDto(program.toObject()))
})
