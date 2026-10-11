/**
 * The household leaderboard: every profile on the account ranked on its training over a window,
 * by reps, sets, weight moved and steadiness (low fatigue), and by an Arc score that factors all of
 * them in. Profiles of one account only: a member's numbers are never compared with strangers'.
 */
import { z } from 'zod'
import { FATIGUE_MIN_REPS } from './engine/fatigue.ts'
import type { SessionRecord } from './engine/types.ts'

export const LEADERBOARD_WINDOWS = { week: 7, month: 30, all: 0 } as const
export type LeaderboardWindow = keyof typeof LEADERBOARD_WINDOWS
export const LeaderboardWindowSchema = z.enum(['week', 'month', 'all'])

/** What a profile can be ranked on; `score` factors in the other four. */
export const LEADERBOARD_METRICS = ['score', 'reps', 'sets', 'volume', 'steadiness'] as const
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number]

export interface LeaderboardRow {
  profileId: string
  name: string
  sessions: number
  reps: number
  sets: number
  /** Weight moved: each session's reps times the weight held, in kilograms. */
  volumeKg: number
  /** The heaviest weight held, or null when no session gave one. */
  topLoadKg: number | null
  /** Mean fatigue proxy over sessions with a set long enough to measure it, or null. */
  fatigue: number | null
  /** 1 minus the fatigue: how well range and tempo held up, or null. */
  steadiness: number | null
  /** 0 to 100: each measure against the household's best, averaged. */
  score: number
  /** Place on each measure, 1 for the best; ties share a place. */
  ranks: Record<LeaderboardMetric, number>
  demo: boolean
}

export interface LeaderboardDto {
  window: LeaderboardWindow
  /** From when the window counts, ms since the epoch; 0 for all time. */
  since: number
  /** The measures the score factored in: weight moved only once someone gave a weight. */
  factors: Exclude<LeaderboardMetric, 'score'>[]
  rows: LeaderboardRow[]
}

type Session = Pick<SessionRecord, 'profileId' | 'startedAt' | 'sets' | 'summary' | 'loadKg' | 'demo'>

/** Places by value, highest first; equal values share a place (1, 1, 3). */
function places(values: number[]): number[] {
  return values.map((v) => 1 + values.filter((x) => x > v).length)
}

/**
 * Ranks the profiles on the sessions since `since`. Reps and sets count everything done; weight
 * moved counts reps times the weight held; steadiness is 1 minus the mean fatigue proxy of
 * sessions with a set long enough to measure it. The Arc score puts each measure against the best in
 * the household and averages them (weight moved only once someone gave a weight), so a profile
 * that leads on everything scores 100. Rows come best score first, then most reps, then by name.
 */
export function leaderboard(profiles: { id: string; name: string }[], sessions: Session[], { window = 'week', now = Date.now() }: { window?: LeaderboardWindow; now?: number } = {}): LeaderboardDto {
  const days = LEADERBOARD_WINDOWS[window]
  const since = days ? now - days * 86_400_000 : 0
  const inWindow = sessions.filter((s) => s.startedAt >= since)
  const base = profiles.map((p) => {
    const mine = inWindow.filter((s) => s.profileId === p.id)
    const reps = mine.reduce((n, s) => n + s.summary.totalReps, 0)
    const sets = mine.reduce((n, s) => n + s.sets.length, 0)
    const volumeKg = Math.round(mine.reduce((n, s) => n + s.summary.totalReps * (s.loadKg ?? 0), 0))
    const loads = mine.map((s) => s.loadKg).filter((x): x is number => x != null)
    // Fatigue is measured only within a set long enough to show it.
    const measured = mine.filter((s) => s.sets.some((set) => set.reps.length >= FATIGUE_MIN_REPS))
    const fatigue = measured.length ? measured.reduce((n, s) => n + s.summary.fatigueIndex, 0) / measured.length : null
    return {
      profileId: p.id,
      name: p.name,
      sessions: mine.length,
      reps,
      sets,
      volumeKg,
      topLoadKg: loads.length ? Math.max(...loads) : null,
      fatigue: fatigue == null ? null : Math.round(fatigue * 1000) / 1000,
      steadiness: fatigue == null ? null : Math.round(Math.max(0, Math.min(1, 1 - fatigue)) * 1000) / 1000,
      demo: mine.length > 0 && mine.every((s) => s.demo),
    }
  })
  const factors: LeaderboardDto['factors'] = ['reps', 'sets', ...(base.some((r) => r.volumeKg > 0) ? (['volume'] as const) : []), 'steadiness']
  const value = (r: (typeof base)[number], m: Exclude<LeaderboardMetric, 'score'>) => (m === 'reps' ? r.reps : m === 'sets' ? r.sets : m === 'volume' ? r.volumeKg : (r.steadiness ?? 0))
  const best = Object.fromEntries(factors.map((m) => [m, Math.max(0, ...base.map((r) => value(r, m)))])) as Record<string, number>
  const scored = base.map((r) => ({
    ...r,
    score: r.sessions === 0 ? 0 : Math.round((100 * factors.reduce((n, m) => n + (best[m] ? value(r, m) / best[m]! : 0), 0)) / factors.length),
  }))
  const rank = (m: LeaderboardMetric) => places(scored.map((r) => (m === 'score' ? r.score : value(r, m))))
  const byMetric = Object.fromEntries(LEADERBOARD_METRICS.map((m) => [m, rank(m)])) as Record<LeaderboardMetric, number[]>
  const rows: LeaderboardRow[] = scored.map((r, i) => ({ ...r, ranks: Object.fromEntries(LEADERBOARD_METRICS.map((m) => [m, byMetric[m][i]!])) as Record<LeaderboardMetric, number> }))
  rows.sort((a, b) => b.score - a.score || b.reps - a.reps || a.name.localeCompare(b.name))
  return { window, since, factors, rows }
}
