import type { Queryable } from './db.ts'

/**
 * The schema, applied at startup and idempotent. Accounts, profiles and plans are ordinary
 * tables. Sessions keep their summary and plan snapshot; sets and reps are their own tables,
 * and `reps` is the time series: one row per rep, keyed by when it started. On a server with
 * the TimescaleDB extension (Tiger Cloud) it becomes a hypertable; elsewhere it is a plain table
 * with the same shape, so the app and the tests behave the same.
 */
export const STATEMENTS: readonly string[] = [
  `create table if not exists users (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     email text not null unique,
     password_hash text not null,
     created_at timestamptz not null default clock_timestamp()
   )`,
  `create table if not exists profiles (
     id uuid primary key default gen_random_uuid(),
     seq bigserial,
     owner_id uuid not null references users(id) on delete cascade,
     name text not null,
     email text,
     notes text,
     created_at timestamptz not null default clock_timestamp()
   )`,
  `create index if not exists profiles_owner_idx on profiles (owner_id, created_at desc, seq desc)`,
  `create table if not exists plans (
     id uuid primary key default gen_random_uuid(),
     seq bigserial,
     profile_id uuid not null references profiles(id) on delete cascade,
     exercise text not null,
     side text not null,
     sets integer not null,
     reps integer not null,
     rest_seconds integer not null,
     target_deg double precision not null,
     active boolean not null default true,
     created_at timestamptz not null default clock_timestamp()
   )`,
  `create index if not exists plans_profile_idx on plans (profile_id, active, created_at desc, seq desc)`,
  `create table if not exists sessions (
     id uuid primary key default gen_random_uuid(),
     profile_id uuid not null references profiles(id) on delete cascade,
     exercise text not null,
     side text not null,
     started_at timestamptz not null,
     ended_at timestamptz not null,
     plan_sets integer not null,
     plan_reps integer not null,
     plan_rest_seconds integer not null,
     plan_target_deg double precision not null,
     total_reps integer not null,
     best_peak_deg double precision not null,
     mean_peak_deg double precision not null,
     fatigue_index double precision not null,
     demo boolean not null default false,
     created_at timestamptz not null default clock_timestamp()
   )`,
  `create index if not exists sessions_profile_started_idx on sessions (profile_id, started_at desc)`,
  `create index if not exists sessions_profile_exercise_idx on sessions (profile_id, exercise, started_at)`,
  `create table if not exists sets (
     session_id uuid not null references sessions(id) on delete cascade,
     set_number integer not null,
     started_at timestamptz not null,
     ended_at timestamptz not null,
     ended_early boolean not null,
     fatigue_index double precision not null,
     rom_decay double precision not null,
     tempo_drift double precision not null,
     rom_drop_deg double precision not null,
     sample_reps integer not null,
     primary key (session_id, set_number)
   )`,
  `create table if not exists reps (
     time timestamptz not null,
     ended_at timestamptz not null,
     duration_ms double precision not null,
     session_id uuid not null references sessions(id) on delete cascade,
     profile_id uuid not null,
     exercise text not null,
     set_number integer not null,
     rep_index integer not null,
     peak_deg double precision not null
   )`,
  `create index if not exists reps_session_idx on reps (session_id, set_number, rep_index)`,
  `create index if not exists reps_profile_time_idx on reps (profile_id, exercise, time desc)`,
]

/** Activates TimescaleDB when the server offers it; false on plain Postgres and in PGlite. */
async function enableTimescale(q: Queryable): Promise<boolean> {
  const installed = await q.query<{ ok: boolean }>(`select exists(select 1 from pg_extension where extname = 'timescaledb') as ok`)
  if (installed[0]?.ok) return true
  const available = await q.query<{ ok: boolean }>(`select exists(select 1 from pg_available_extensions where name = 'timescaledb') as ok`)
  if (!available[0]?.ok) return false
  try {
    await q.query('create extension if not exists timescaledb')
    return true
  } catch {
    return false
  }
}

export async function migrate(q: Queryable): Promise<{ timescale: boolean }> {
  for (const statement of STATEMENTS) await q.query(statement)
  const timescale = await enableTimescale(q)
  if (timescale) await q.query(`select create_hypertable('reps', 'time', if_not_exists => true)`)
  return { timescale }
}
