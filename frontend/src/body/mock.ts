import { MUSCLE_IDS, type MuscleId } from '@arc/dependencies'
import type { Growth } from '../components/three/body/figure'
import { overallOf } from './growth'

/*
 * The mock transformation, for demos: the figure goes from the skinny start to an end build drawn
 * at random, week by week over a year, quick at first and slowing as it nears the end, the way the
 * growth model behaves. It is not the member's data, and the page says so.
 */

/** Weeks the mock transformation runs over. */
export const MOCK_WEEKS = 52

/** Kinds of end build: each group's level, the rest at `others`. */
const BUILDS: { name: string; others: number; levels: Partial<Record<MuscleId, number>> }[] = [
  { name: 'All-round athlete', others: 0.7, levels: { quads: 0.8, glutes: 0.75, chest: 0.75, lats: 0.75, side_delts: 0.75 } },
  { name: 'Beach body', others: 0.45, levels: { chest: 0.92, front_delts: 0.85, side_delts: 0.9, biceps: 0.92, triceps: 0.85, abs: 0.88, obliques: 0.7, forearms: 0.65 } },
  { name: 'Powerlifter', others: 0.6, levels: { quads: 0.95, glutes: 0.95, hamstrings: 0.88, lower_back: 0.92, traps: 0.9, upper_back: 0.85, lats: 0.78, chest: 0.75, forearms: 0.8 } },
  { name: 'V-taper', others: 0.5, levels: { lats: 0.95, upper_back: 0.88, side_delts: 0.95, rear_delts: 0.88, traps: 0.72, chest: 0.72, abs: 0.7, biceps: 0.7 } },
  { name: 'Leg day every day', others: 0.32, levels: { quads: 0.95, glutes: 0.92, hamstrings: 0.9, calves: 0.92, lower_back: 0.6 } },
  { name: 'Lean runner', others: 0.25, levels: { calves: 0.72, quads: 0.6, hamstrings: 0.6, glutes: 0.55, abs: 0.6, obliques: 0.5 } },
]

export interface EndBuild {
  name: string
  growth: Growth
}

/** A random end build: one of the kinds, each group nudged up or down a little so no two match. */
export function randomEndBuild(random: () => number = Math.random): EndBuild {
  const build = BUILDS[Math.floor(random() * BUILDS.length) % BUILDS.length]!
  const levels = Object.fromEntries(MUSCLE_IDS.map((m) => [m, Math.min(1, Math.max(0.15, (build.levels[m] ?? build.others) + (random() - 0.5) * 0.18))])) as Record<MuscleId, number>
  return { name: build.name, growth: { levels, overall: overallOf(levels) } }
}

/** The body `week` weeks into the mock: most of the change early, slowing toward the end build. */
export function mockGrowthAt(end: Growth, week: number): Growth {
  const t = Math.min(1, Math.max(0, week / MOCK_WEEKS))
  const share = 1 - (1 - t) ** 1.8
  const levels = Object.fromEntries(MUSCLE_IDS.map((m) => [m, (end.levels[m] ?? 0) * share])) as Record<MuscleId, number>
  return { levels, overall: overallOf(levels) }
}
