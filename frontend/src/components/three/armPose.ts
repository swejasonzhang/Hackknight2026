import type { ExerciseId } from '@arc/dependencies'

/**
 * Where a two-segment limb sits for a given exercise and metric angle, in a flat XY plane
 * (metres-ish units, +Y up, +X forward / outward). The 3D scene turns this into geometry;
 * the maths stays here so it can be unit-tested without WebGL.
 *
 * Each exercise is a proximal segment that does not move and a distal segment that rotates
 * at the middle joint. Direction angles are degrees from +X, counter-clockwise.
 */
export interface Pose {
  /** The fixed end of the proximal segment (shoulder, hip, hip). */
  base: [number, number]
  /** The moving joint (elbow, shoulder, knee). */
  mid: [number, number]
  /** The far end of the distal segment (wrist, elbow, ankle). */
  end: [number, number]
  /** Direction of the distal segment, degrees from +X. */
  distalDeg: number
  /** Where the gauge arc starts: the distal direction at the lowest metric the gauge shows. */
  gaugeFromDeg: number
  /** The inner joint angle a goniometer would read, degrees. */
  innerDeg: number
  /** Names for the three landmarks, proximal to distal. */
  landmarks: [string, string, string]
}

export const PROXIMAL = 1.1
export const DISTAL = 1.0

const rad = (deg: number) => (deg * Math.PI) / 180

function endOf(mid: [number, number], distalDeg: number): [number, number] {
  return [mid[0] + DISTAL * Math.cos(rad(distalDeg)), mid[1] + DISTAL * Math.sin(rad(distalDeg))]
}

/** Clamp the metric to the range the gauge draws for the exercise. */
export function clampMetric(exercise: ExerciseId, metricDeg: number): number {
  const [lo, hi] = exercise === 'seated_knee_extension' ? [90, 180] : [0, 180]
  return Math.min(hi, Math.max(lo, metricDeg))
}

export function armPose(exercise: ExerciseId, metricDeg: number): Pose {
  const m = clampMetric(exercise, metricDeg)
  switch (exercise) {
    case 'elbow_flexion': {
      // Upper arm hangs straight down from the shoulder; the forearm swings forward and up.
      const base: [number, number] = [0, 0.95]
      const mid: [number, number] = [0, 0.95 - PROXIMAL]
      const distalDeg = -90 + m
      return { base, mid, end: endOf(mid, distalDeg), distalDeg, gaugeFromDeg: -90, innerDeg: 180 - m, landmarks: ['shoulder', 'elbow', 'wrist'] }
    }
    case 'shoulder_abduction': {
      // Torso stands still from hip to shoulder; the upper arm rises out to the side.
      const base: [number, number] = [0, -0.85]
      const mid: [number, number] = [0, -0.85 + PROXIMAL]
      const distalDeg = -90 + m
      return { base, mid, end: endOf(mid, distalDeg), distalDeg, gaugeFromDeg: -90, innerDeg: m, landmarks: ['hip', 'shoulder', 'elbow'] }
    }
    case 'seated_knee_extension': {
      // Seated: the thigh is level from hip to knee; the shin hangs at 90 and straightens to 180.
      const base: [number, number] = [-PROXIMAL / 2, 0.35]
      const mid: [number, number] = [PROXIMAL / 2, 0.35]
      const distalDeg = m - 180
      return { base, mid, end: endOf(mid, distalDeg), distalDeg, gaugeFromDeg: -90, innerDeg: m, landmarks: ['hip', 'knee', 'ankle'] }
    }
  }
}
