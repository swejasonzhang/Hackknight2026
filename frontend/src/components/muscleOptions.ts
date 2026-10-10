import { EXERCISE_LIST, exercisesFor, MUSCLE_IDS, MUSCLES, type ExerciseId, type MuscleId } from '@arc/dependencies'

/** A muscle group to pick, or every movement. */
export type Target = MuscleId | 'all'

export const MUSCLE_OPTIONS: { value: Target; label: string }[] = [{ value: 'all', label: 'Every muscle' }, ...MUSCLE_IDS.map((m) => ({ value: m, label: MUSCLES[m].name }))]

/** The movements for a muscle: those that target it (the most focused first), then those it helps in; every movement for "all". */
export function exerciseOptions(target: Target): { value: ExerciseId; label: string }[] {
  if (target === 'all') return EXERCISE_LIST.map((ex) => ({ value: ex.id, label: ex.name }))
  const { primary, secondary } = exercisesFor(target)
  return [...primary.map((ex) => ({ value: ex.id, label: ex.name })), ...secondary.map((ex) => ({ value: ex.id, label: `${ex.name} (also works it)` }))]
}
