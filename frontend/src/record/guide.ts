import { EXERCISES, type ExerciseId, type RepPhase } from '@arc/dependencies'

/** What each movement asks for: on the way to the goal, and on the way back to the start. */
export const MOTION_WORDS: Record<ExerciseId, readonly [toGoal: string, back: string]> = {
  elbow_flexion: ['Curl up', 'Lower'],
  tricep_extension: ['Push down', 'Return'],
  shoulder_press: ['Press up', 'Lower'],
  shoulder_abduction: ['Raise', 'Lower'],
  front_raise: ['Raise', 'Lower'],
  chest_press: ['Push', 'Return'],
  pec_fly: ['Close', 'Open'],
  lat_pulldown: ['Pull down', 'Return'],
  bent_over_row: ['Pull', 'Lower'],
  deadlift: ['Stand tall', 'Hinge down'],
  squat: ['Sit down', 'Stand up'],
  lunge: ['Lower', 'Push up'],
  seated_knee_extension: ['Straighten', 'Lower'],
  crunch: ['Curl up', 'Lower'],
  ab_twist: ['Twist', 'Return'],
}

export interface Guide {
  /** Where the movement is heading now: to the goal, or back to the start. */
  heading: 'goal' | 'start'
  /** The rep has reached the goal. */
  atGoal: boolean
  /** The word to show: what to do now. */
  label: string
  /**
   * The arc to draw round the working joint, in the picture's own angles (radians, y down): from
   * the moving segment now to where it is heading, with the goal marked. Null for the ab twist,
   * which is a tilt of the shoulder line, not an angle at a joint.
   */
  arc: { centre: [number, number]; radius: number; from: number; to: number; goalAt: number } | null
}

const wrap = (r: number) => {
  let x = r
  while (x > Math.PI) x -= 2 * Math.PI
  while (x <= -Math.PI) x += 2 * Math.PI
  return x
}
const rad = (d: number) => (d * Math.PI) / 180

/**
 * The movement indicator over the camera: which way to move now and how far is left, drawn as an
 * arc round the working joint from the moving segment to the goal (on the way up) or back to the
 * start (on the way down). `points` are the three tracked landmarks in pixels, proximal to distal.
 */
export function guideFor(exercise: ExerciseId, repPhase: RepPhase, metricDeg: number, goalDeg: number, points: readonly [readonly [number, number], readonly [number, number], readonly [number, number]]): Guide {
  const cfg = EXERCISES[exercise]
  const [toGoal, back] = MOTION_WORDS[exercise]
  const heading = repPhase === 'peak' || repPhase === 'returning' ? 'start' : 'goal'
  const atGoal = metricDeg >= goalDeg - 1
  const label = heading === 'goal' ? (atGoal ? `Goal · ${back.toLowerCase()}` : toGoal) : back
  if (cfg.measure === 'tilt') return { heading, atGoal, label, arc: null }
  const [base, mid, end] = points
  const a: [number, number] = [base[0] - mid[0], base[1] - mid[1]]
  const e: [number, number] = [end[0] - mid[0], end[1] - mid[1]]
  const angA = Math.atan2(a[1], a[0])
  const angE = Math.atan2(e[1], e[0])
  const side = Math.sign(wrap(angE - angA)) || 1
  // The metric is the inner angle itself (opening the joint) or 180 minus it (closing it).
  const opens = cfg.metricFromInnerAngle(100) === 100
  const turn = opens ? side : -side
  const target = heading === 'goal' ? goalDeg : cfg.restDeg
  const reach = Math.hypot(e[0], e[1])
  return {
    heading,
    atGoal,
    label,
    arc: {
      centre: [mid[0], mid[1]],
      radius: Math.max(28, Math.min(140, reach * 0.55)),
      from: angE,
      to: angE + turn * rad(target - metricDeg),
      goalAt: angE + turn * rad(goalDeg - metricDeg),
    },
  }
}
