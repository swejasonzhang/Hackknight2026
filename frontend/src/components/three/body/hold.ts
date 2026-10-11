import type { ExerciseId } from '@arc/dependencies'
import type { Grip, HandleLine } from './figure'

/** What a hand holds: a dumbbell, a cable's handle, or nothing. */
export type Held = 'dumbbell' | 'handle' | null

export interface Hold {
  /** How closed each hand is: 1 round a handle, a little for a relaxed hand. */
  grip: Grip
  /** What each hand holds (the figure works on its right side). */
  right: Held
  left: Held
  /** A bar held in both hands (a lat pulldown's), instead of anything in either. */
  bar?: boolean
  /** Which way the handles lie (figure.ts): the wrists turn to hold them so. */
  line?: HandleLine
}

/** A relaxed hand, the fingers a little curled. */
const RELAXED = 0.18
/** Both hands relaxed and empty: a figure standing, not training. */
export const RELAXED_HANDS: Grip = { right: RELAXED, left: RELAXED }
/** Hands held together in front, or folded on the chest. */
const CLASPED = 0.55

/**
 * What each movement's hands hold, as it is done in a gym: a one-arm movement holds its weight in
 * the working hand and leaves the other relaxed; a two-arm one holds a weight in each.
 */
export const HOLDS: Record<ExerciseId, Hold> = {
  // A hammer curl: the dumbbell upright in the hand all the way, which reads clearly side on.
  elbow_flexion: { grip: { right: 1, left: RELAXED }, right: 'dumbbell', left: null, line: 'forward' },
  tricep_extension: { grip: { right: 1, left: RELAXED }, right: 'handle', left: null, line: 'across' },
  shoulder_press: { grip: { right: 1, left: 1 }, right: 'dumbbell', left: 'dumbbell', line: 'across' },
  shoulder_abduction: { grip: { right: 1, left: RELAXED }, right: 'dumbbell', left: null, line: 'forward' },
  front_raise: { grip: { right: 1, left: RELAXED }, right: 'dumbbell', left: null, line: 'across' },
  chest_press: { grip: { right: 1, left: 1 }, right: 'handle', left: 'handle', line: 'across' },
  pec_fly: { grip: { right: 1, left: 1 }, right: 'handle', left: 'handle', line: 'upright' },
  lat_pulldown: { grip: { right: 1, left: 1 }, right: null, left: null, bar: true, line: 'across' },
  bent_over_row: { grip: { right: 1, left: RELAXED }, right: 'dumbbell', left: null, line: 'forward' },
  deadlift: { grip: { right: 1, left: 1 }, right: 'dumbbell', left: 'dumbbell', line: 'across' },
  squat: { grip: { right: RELAXED, left: RELAXED }, right: null, left: null },
  lunge: { grip: { right: RELAXED, left: RELAXED }, right: null, left: null },
  seated_knee_extension: { grip: { right: RELAXED, left: RELAXED }, right: null, left: null },
  crunch: { grip: { right: CLASPED, left: CLASPED }, right: null, left: null },
  ab_twist: { grip: { right: CLASPED, left: CLASPED }, right: null, left: null },
}
