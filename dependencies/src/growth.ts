/**
 * How training grows the body. The figure starts skinny, every muscle group at level 0, and each
 * group grows with the sets that work it: fully for the muscles an exercise targets, half for the
 * ones that help, pro rata for a short set, and up to half again for a weight held. A week of work
 * adds a share of what the group has left to gain, so returns diminish twice over: the week's dose
 * saturates, and the nearer the top, the less a week adds. A group left alone for more than two
 * weeks starts to give some back. A model for drawing the figure, not a measurement of the member.
 */
import type { Figure } from './api.ts'
import { EXERCISES } from './engine/exercises.ts'
import { EXERCISE_IDS, MUSCLE_IDS, type MuscleId, type SessionRecord } from './engine/types.ts'

/** How the model turns sets into growth; exported so the docs and tests can name the numbers. */
export const GROWTH = {
  primary: 1, // a set counts fully for a muscle the exercise targets
  secondary: 0.5, // and half for one that helps (fractional set counting)
  fullSetReps: 6, // a set of 6 or more counted reps is one full set; fewer count pro rata
  loadBonusKg: 30, // a weight held adds up to `loadBonus` more stimulus, full at 30 kg
  loadBonus: 0.5,
  rate: 0.12, // the most a week can add, as a share of what is left to gain
  halfSets: 8, // weekly effective sets that give half of that most
  idleWeeks: 2, // weeks without work before a muscle starts to shrink
  lossPerWeek: 0.03, // then it gives back this share of its level each idle week
} as const

/** Rough share of the body's muscle each group is, for `overall`; normalised there, so they need not add up to 1. */
export const MUSCLE_SIZE: Record<MuscleId, number> = {
  quads: 0.14,
  glutes: 0.1,
  hamstrings: 0.08,
  lats: 0.08,
  chest: 0.08,
  upper_back: 0.06,
  traps: 0.05,
  lower_back: 0.05,
  calves: 0.05,
  triceps: 0.05,
  abs: 0.05,
  biceps: 0.04,
  forearms: 0.04,
  obliques: 0.04,
  front_delts: 0.03,
  side_delts: 0.03,
  rear_delts: 0.02,
}

export interface MuscleGrowth {
  /** 0..1: untrained (the skinny start) to the most muscular the figure shows. */
  level: number
  /** Effective sets in the last 28 days and ever (primary 1, secondary 0.5, pro rata for short sets). */
  recentSets: number
  totalSets: number
  /**
   * Level now minus level at the end of the fourth week back, so what the last four weeks did. When
   * they hold all the training, the level then was the start, 0, and the change is the whole level.
   */
  change: number
}

export interface GrowthWeek {
  /**
   * The Monday, 00:00 UTC, that starts the window, ms since the epoch. A window runs up to the next
   * Monday (the last one up to `now`), and a session at exactly `from` falls in it.
   */
  from: number
  /** Each group's level at the end of the window. */
  levels: Record<MuscleId, number>
}

/** GET /api/profiles/:id/body */
export interface BodyDto {
  profileId: string
  /** The body the figure is drawn as, or null when the member has not picked one. */
  figure: Figure | null
  /** When the levels were worked out, ms since the epoch: the end of the last window. */
  asOf: number
  /** The whole body's level: the groups' levels averaged by how much of the body each is (MUSCLE_SIZE). */
  overall: number
  muscles: Record<MuscleId, MuscleGrowth>
  /** Oldest first: one window per UTC week (Monday to Monday) from the first session's week to this one; at most 104. */
  weeks: GrowthWeek[]
}

/** What the model reads of a session. */
export type GrowthSession = Pick<SessionRecord, 'exercise' | 'startedAt' | 'sets' | 'loadKg'>

const WEEK = 7 * 86_400_000
/**
 * Monday 5 January 1970, 00:00 UTC. The windows are the UTC weeks from one Monday to the next, the
 * weeks progress.ts counts sessions in. Fixed weeks rather than 7 days back from `now`: a session
 * keeps its window as time passes, so with no new training a level moves only when another idle
 * week begins, never because the day changed and the sessions fell into windows differently.
 */
const EPOCH_MONDAY = Date.UTC(1970, 0, 5)
/** The UTC week `t` falls in, counted in weeks from EPOCH_MONDAY. */
const weekOf = (t: number) => Math.floor((t - EPOCH_MONDAY) / WEEK)
/** `recentSets` counts the last 28 days, and `change` looks four windows back. */
const RECENT_WEEKS = 4
/** The most windows `weeks` lists: two years. Training before them still counts in the levels. */
const MAX_WEEKS = 104

/** A number for every muscle group, all 0. */
const perMuscle = () => Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0])) as Record<MuscleId, number>

/**
 * One trained week of a group: a share of what is left to gain, the share rising with the week's
 * stimulus (effective sets) and saturating. The history (`bodyGrowth`) and a challenge's
 * projection (challenges.ts) both grow a level this way.
 */
export function growWeek(level: number, stimulus: number): number {
  if (stimulus <= 0) return level
  return Math.min(1, level + ((GROWTH.rate * stimulus) / (stimulus + GROWTH.halfSets)) * (1 - level))
}

/**
 * The body the sessions have grown by `now`. Time runs in windows of one UTC week, Monday to
 * Monday; the last is the week of `now`, up to `now`. From the first session's week, each group's
 * level rises with the window's stimulus (see GROWTH), or after more than `idleWeeks` windows
 * without any, shrinks. Sessions after `now` are ignored and their order never matters: the same
 * sessions and `now` give the same numbers, and the levels stay put until a session is added or
 * another week begins.
 */
export function bodyGrowth(sessions: readonly GrowthSession[], { now }: { now: number }): Omit<BodyDto, 'profileId' | 'figure'> {
  const thisWeek = weekOf(now)
  // Each session once: its window, whether it is from the last 28 days, its sets counted pro rata
  // and its weight's bonus. Sorted on what sets the amounts it adds, so the sums of fractions below
  // come out the same to the last bit in any input order.
  const done = sessions
    .filter((s) => s.startedAt <= now)
    .map((s) => ({
      back: thisWeek - weekOf(s.startedAt),
      recent: now - s.startedAt < RECENT_WEEKS * WEEK,
      exercise: s.exercise,
      sets: s.sets.reduce((n, set) => n + Math.min(GROWTH.fullSetReps, set.reps.length), 0) / GROWTH.fullSetReps,
      load: 1 + GROWTH.loadBonus * Math.min(1, (s.loadKg ?? 0) / GROWTH.loadBonusKg),
    }))
    .sort((a, b) => b.back - a.back || EXERCISE_IDS.indexOf(a.exercise) - EXERCISE_IDS.indexOf(b.exercise) || a.sets - b.sets || a.load - b.load)

  const windows = done.reduce((n, s) => Math.max(n, s.back + 1), 0)
  // Each window's stimulus per group, by how many weeks before this one it is.
  const stimulus = Array.from({ length: windows }, perMuscle)
  const recentSets = perMuscle()
  const totalSets = perMuscle()
  for (const s of done) {
    const { primary, secondary } = EXERCISES[s.exercise].muscles
    for (const [muscles, role] of [[primary, GROWTH.primary], [secondary, GROWTH.secondary]] as const) {
      for (const m of muscles) {
        stimulus[s.back]![m] += role * s.sets * s.load
        totalSets[m] += role * s.sets
        if (s.recent) recentSets[m] += role * s.sets
      }
    }
  }

  // Window by window from the oldest. Every window counts, so a long gap keeps shrinking a group.
  const level = perMuscle()
  const idle = perMuscle()
  const weeks: GrowthWeek[] = []
  let monthAgo: Record<MuscleId, number> | null = null
  for (let back = windows - 1; back >= 0; back--) {
    for (const m of MUSCLE_IDS) {
      const s = stimulus[back]![m]
      if (s > 0) {
        idle[m] = 0
        level[m] = growWeek(level[m], s)
      } else if (++idle[m] > GROWTH.idleWeeks) {
        level[m] -= GROWTH.lossPerWeek * level[m]
      }
      level[m] = Math.min(1, Math.max(0, level[m]))
    }
    if (back === RECENT_WEEKS) monthAgo = { ...level }
    if (back < MAX_WEEKS) weeks.push({ from: EPOCH_MONDAY + (thisWeek - back) * WEEK, levels: { ...level } })
  }

  const bodySize = MUSCLE_IDS.reduce((n, m) => n + MUSCLE_SIZE[m], 0)
  return {
    asOf: now,
    overall: MUSCLE_IDS.reduce((n, m) => n + level[m] * MUSCLE_SIZE[m], 0) / bodySize,
    muscles: Object.fromEntries(
      // No window four back means every session came after it, when each group was still at 0.
      MUSCLE_IDS.map((m) => [m, { level: level[m], recentSets: recentSets[m], totalSets: totalSets[m], change: level[m] - (monthAgo?.[m] ?? 0) }]),
    ) as Record<MuscleId, MuscleGrowth>,
    weeks,
  }
}
