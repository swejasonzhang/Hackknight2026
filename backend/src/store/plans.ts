import type { ExerciseId, PlanDto, PlanInput, Side, UpdatePlanInput } from '@arc/dependencies'
import type { Db, Queryable } from '../db.ts'
import { ms } from '../sql.ts'

export interface PlanRow {
  id: string
  profile_id: string
  exercise: ExerciseId
  side: Side
  sets: number
  reps: number
  rest_seconds: number
  target_deg: number
  active: boolean
  created_at: number
}

const COLS = `id, profile_id, exercise, side, sets, reps, rest_seconds, target_deg, active, ${ms('created_at')} as created_at`

/** The profile's active plan, optionally only if it covers one exercise. */
export async function activePlan(q: Queryable, profileId: string, exercise?: ExerciseId): Promise<PlanRow | null> {
  const params: unknown[] = [profileId]
  let where = 'profile_id = $1 and active'
  if (exercise) {
    params.push(exercise)
    where += ' and exercise = $2'
  }
  const [row] = await q.query<PlanRow>(`select ${COLS} from plans where ${where} order by created_at desc, seq desc limit 1`, params)
  return row ?? null
}

export async function listPlans(q: Queryable, profileId: string): Promise<PlanRow[]> {
  return q.query<PlanRow>(`select ${COLS} from plans where profile_id = $1 order by created_at desc, seq desc`, [profileId])
}

/** Retires the current plan and stores the new one as active; the old one stays in history. */
export async function replacePlan(database: Db, profileId: string, input: PlanInput, createdAt?: number): Promise<PlanRow> {
  return database.transaction(async (tx) => {
    await tx.query('update plans set active = false where profile_id = $1 and active', [profileId])
    const [row] = await tx.query<PlanRow>(
      `insert into plans (profile_id, exercise, side, sets, reps, rest_seconds, target_deg, active, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, true, coalesce(to_timestamp($8::float8 / 1000.0), clock_timestamp())) returning ${COLS}`,
      [profileId, input.exercise, input.side, input.sets, input.reps, input.restSeconds, input.targetDeg, createdAt ?? null],
    )
    return row!
  })
}

const COLUMN: Record<keyof UpdatePlanInput, string> = { exercise: 'exercise', side: 'side', sets: 'sets', reps: 'reps', restSeconds: 'rest_seconds', targetDeg: 'target_deg' }

/** Changes part of the active plan in place; null when there is no active plan. */
export async function patchPlan(q: Queryable, profileId: string, input: UpdatePlanInput): Promise<PlanRow | null> {
  const assignments: string[] = []
  const params: unknown[] = [profileId]
  for (const key of Object.keys(COLUMN) as (keyof UpdatePlanInput)[]) {
    const value = input[key]
    if (value === undefined) continue
    params.push(value)
    assignments.push(`${COLUMN[key]} = $${params.length}`)
  }
  if (!assignments.length) return activePlan(q, profileId)
  const [row] = await q.query<PlanRow>(`update plans set ${assignments.join(', ')} where profile_id = $1 and active returning ${COLS}`, params)
  return row ?? null
}

export function toPlanDto(p: PlanRow): PlanDto {
  return {
    id: p.id,
    profileId: p.profile_id,
    exercise: p.exercise,
    side: p.side,
    sets: p.sets,
    reps: p.reps,
    restSeconds: p.rest_seconds,
    targetDeg: p.target_deg,
    active: p.active,
    createdAt: Math.round(p.created_at),
  }
}
