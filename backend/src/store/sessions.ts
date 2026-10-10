import type { ExerciseId, SessionDto, SessionPlan, SessionSummary, SetRecord, Side } from '@arc/dependencies'
import type { Db, Queryable } from '../db.ts'
import { isUuid, ms, ts } from '../sql.ts'

interface SessionRow {
  id: string
  profile_id: string
  exercise: ExerciseId
  side: Side
  started_at: number
  ended_at: number
  plan_sets: number
  plan_reps: number
  plan_rest_seconds: number
  plan_target_deg: number
  total_reps: number
  best_peak_deg: number
  mean_peak_deg: number
  fatigue_index: number
  demo: boolean
}

interface SetRow {
  session_id: string
  set_number: number
  started_at: number
  ended_at: number
  ended_early: boolean
  fatigue_index: number
  rom_decay: number
  tempo_drift: number
  rom_drop_deg: number
  sample_reps: number
}

interface RepRow {
  session_id: string
  set_number: number
  rep_index: number
  peak_deg: number
  started_at: number
  ended_at: number
  duration_ms: number
}

const SESSION_COLS = `s.id, s.profile_id, s.exercise, s.side, ${ms('s.started_at')} as started_at, ${ms('s.ended_at')} as ended_at,
  s.plan_sets, s.plan_reps, s.plan_rest_seconds, s.plan_target_deg, s.total_reps, s.best_peak_deg, s.mean_peak_deg, s.fatigue_index, s.demo`

export interface NewSession {
  profileId: string
  exercise: ExerciseId
  side: Side
  startedAt: number
  endedAt: number
  plan: SessionPlan
  sets: SetRecord[]
  summary: SessionSummary
  demo: boolean
}

/** Writes one session with its sets and reps. Call inside a transaction. Returns the new id. */
export async function insertSession(tx: Queryable, s: NewSession): Promise<string> {
  const [row] = await tx.query<{ id: string }>(
    `insert into sessions (profile_id, exercise, side, started_at, ended_at, plan_sets, plan_reps, plan_rest_seconds, plan_target_deg,
       total_reps, best_peak_deg, mean_peak_deg, fatigue_index, demo)
     values ($1, $2, $3, ${ts('$4')}, ${ts('$5')}, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
    [
      s.profileId,
      s.exercise,
      s.side,
      s.startedAt,
      s.endedAt,
      s.plan.sets,
      s.plan.reps,
      s.plan.restSeconds,
      s.plan.targetDeg,
      s.summary.totalReps,
      s.summary.bestPeakDeg,
      s.summary.meanPeakDeg,
      s.summary.fatigueIndex,
      s.demo,
    ],
  )
  const id = row!.id
  await tx.query(
    `insert into sets (session_id, set_number, started_at, ended_at, ended_early, fatigue_index, rom_decay, tempo_drift, rom_drop_deg, sample_reps)
     select $1::uuid, (x->>'setNumber')::int, ${ts("x->>'startedAt'")}, ${ts("x->>'endedAt'")}, (x->>'endedEarly')::boolean,
       (x#>>'{fatigue,index}')::float8, (x#>>'{fatigue,romDecay}')::float8, (x#>>'{fatigue,tempoDrift}')::float8,
       (x#>>'{fatigue,romDropDeg}')::float8, (x#>>'{fatigue,sampleReps}')::int
     from jsonb_array_elements($2::jsonb) as x`,
    [id, JSON.stringify(s.sets)],
  )
  const reps = s.sets.flatMap((set) => set.reps.map((r) => ({ setNumber: set.setNumber, ...r })))
  await tx.query(
    `insert into reps (time, ended_at, duration_ms, session_id, profile_id, exercise, set_number, rep_index, peak_deg)
     select ${ts("x->>'startedAt'")}, ${ts("x->>'endedAt'")}, (x->>'durationMs')::float8, $1::uuid, $2::uuid, $3::text,
       (x->>'setNumber')::int, (x->>'index')::int, (x->>'peakDeg')::float8
     from jsonb_array_elements($4::jsonb) as x`,
    [id, s.profileId, s.exercise, JSON.stringify(reps)],
  )
  return id
}

/** Stores a session atomically and returns it as the API sends it. */
export async function storeSession(database: Db, s: NewSession): Promise<SessionDto> {
  const id = await database.transaction((tx) => insertSession(tx, s))
  const stored = await findSession(database, id)
  if (!stored) throw new Error('Stored session could not be read back')
  return stored
}

/** Sessions matching a condition on alias `s`, with their sets and reps, assembled into DTOs. */
async function loadSessions(q: Queryable, where: string, params: readonly unknown[], order: string): Promise<SessionDto[]> {
  const sessions = await q.query<SessionRow>(`select ${SESSION_COLS} from sessions s where ${where} order by ${order}`, params)
  if (!sessions.length) return []
  const ids = `select s.id from sessions s where ${where}`
  const sets = await q.query<SetRow>(
    `select session_id, set_number, ${ms('started_at')} as started_at, ${ms('ended_at')} as ended_at, ended_early,
       fatigue_index, rom_decay, tempo_drift, rom_drop_deg, sample_reps
     from sets where session_id in (${ids}) order by set_number`,
    params,
  )
  const reps = await q.query<RepRow>(
    `select session_id, set_number, rep_index, peak_deg, ${ms('time')} as started_at, ${ms('ended_at')} as ended_at, duration_ms
     from reps where session_id in (${ids}) order by set_number, rep_index`,
    params,
  )

  const repsBySet = new Map<string, RepRow[]>()
  for (const r of reps) {
    const key = `${r.session_id}:${r.set_number}`
    const list = repsBySet.get(key)
    if (list) list.push(r)
    else repsBySet.set(key, [r])
  }
  const setsBySession = new Map<string, SetRecord[]>()
  for (const set of sets) {
    const record: SetRecord = {
      setNumber: set.set_number,
      reps: (repsBySet.get(`${set.session_id}:${set.set_number}`) ?? []).map((r) => ({
        index: r.rep_index,
        peakDeg: r.peak_deg,
        startedAt: Math.round(r.started_at),
        endedAt: Math.round(r.ended_at),
        durationMs: r.duration_ms,
      })),
      fatigue: { index: set.fatigue_index, romDecay: set.rom_decay, tempoDrift: set.tempo_drift, romDropDeg: set.rom_drop_deg, sampleReps: set.sample_reps },
      startedAt: Math.round(set.started_at),
      endedAt: Math.round(set.ended_at),
      endedEarly: set.ended_early,
    }
    const list = setsBySession.get(set.session_id)
    if (list) list.push(record)
    else setsBySession.set(set.session_id, [record])
  }

  return sessions.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    exercise: row.exercise,
    side: row.side,
    startedAt: Math.round(row.started_at),
    endedAt: Math.round(row.ended_at),
    plan: { sets: row.plan_sets, reps: row.plan_reps, restSeconds: row.plan_rest_seconds, targetDeg: row.plan_target_deg },
    sets: setsBySession.get(row.id) ?? [],
    summary: { totalReps: row.total_reps, bestPeakDeg: row.best_peak_deg, meanPeakDeg: row.mean_peak_deg, fatigueIndex: row.fatigue_index },
    demo: row.demo,
  }))
}

export async function findSession(q: Queryable, id: string | undefined): Promise<SessionDto | null> {
  if (!isUuid(id)) return null
  const [session] = await loadSessions(q, 's.id = $1', [id], 's.started_at')
  return session ?? null
}

/** A profile's sessions, newest first, optionally for one exercise. */
export async function listSessions(q: Queryable, profileId: string, exercise?: ExerciseId): Promise<SessionDto[]> {
  if (exercise) return loadSessions(q, 's.profile_id = $1 and s.exercise = $2', [profileId, exercise], 's.started_at desc, s.id desc')
  return loadSessions(q, 's.profile_id = $1', [profileId], 's.started_at desc, s.id desc')
}

/** A profile's sessions for one exercise, oldest first, for the progress aggregation. */
export async function sessionsForProgress(q: Queryable, profileId: string, exercise: ExerciseId): Promise<SessionDto[]> {
  return loadSessions(q, 's.profile_id = $1 and s.exercise = $2', [profileId, exercise], 's.started_at, s.id')
}

export async function countSessions(q: Queryable, profileId: string): Promise<number> {
  const [row] = await q.query<{ n: number }>('select count(*)::int as n from sessions where profile_id = $1', [profileId])
  return row?.n ?? 0
}
