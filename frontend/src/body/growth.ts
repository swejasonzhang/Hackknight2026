import { MUSCLE_IDS, MUSCLE_SIZE, type BodyDto, type Figure, type MuscleId } from '@arc/dependencies'
import type { Growth } from '../components/three/body/figure'
import type { FigureKey } from '../components/three/skeleton'

/** The figure to draw for a profile: the body it picked, or between the two when it has not. */
export const figureKey = (figure: Figure | null | undefined): FigureKey => figure ?? 'neutral'

const SIZE_TOTAL = MUSCLE_IDS.reduce((s, m) => s + MUSCLE_SIZE[m], 0)

/** The whole body's level from its groups', averaged by how much of the body each is, as the server works it out. */
export const overallOf = (levels: Record<MuscleId, number>): number => MUSCLE_IDS.reduce((s, m) => s + MUSCLE_SIZE[m] * levels[m], 0) / SIZE_TOTAL

/** The growth the figure shows today. */
export function growthNow(body: BodyDto): Growth {
  return { levels: Object.fromEntries(MUSCLE_IDS.map((m) => [m, body.muscles[m].level])) as Record<MuscleId, number>, overall: body.overall }
}

/** The growth at the end of one of the body's weeks (oldest first); past the last, today's. */
export function growthAt(body: BodyDto, week: number): Growth {
  const w = body.weeks[week]
  if (!w || week >= body.weeks.length - 1) return growthNow(body)
  return { levels: w.levels, overall: overallOf(w.levels) }
}

/** The muscle groups, most grown first (catalog order between equals). */
export function rankedMuscles(levels: Record<MuscleId, number>): MuscleId[] {
  return [...MUSCLE_IDS].sort((a, b) => levels[b] - levels[a] || MUSCLE_IDS.indexOf(a) - MUSCLE_IDS.indexOf(b))
}

/** A level as a whole percentage of the way from the skinny start to the most built. */
export const percent = (level: number) => Math.round(Math.max(0, Math.min(1, level)) * 100)
