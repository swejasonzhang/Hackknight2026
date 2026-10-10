import { EXERCISES, type ExerciseId, type Side } from '@arc/dependencies'
import { directionFor, restFor } from '../components/three/skeleton'
import type { Landmark } from './angle'
import type { PoseTracker } from './pose'

/**
 * Development only (`/record?simulate`): a pretend person doing reps from rest to `peakDeg` and
 * back, one every `periodMs`, as pose landmarks at the exercise's three joints. It exercises the
 * whole record → count → rest → save path in a browser without a camera or a person.
 */
export function simulatedLandmarks(exercise: ExerciseId, side: Side, metricDeg: number, aspect = 16 / 9): Landmark[] {
  const all: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }))
  const [iBase, iMid, iEnd] = EXERCISES[exercise].joints[side]
  // Directions in a y-up frame, degrees from +x: where the fixed segment points from the joint,
  // and where the moving one points for this reading (the same maths as the 3D figure).
  const baseDir = exercise === 'elbow_flexion' ? 90 : exercise === 'shoulder_abduction' ? -90 : 180
  const endDir = directionFor(exercise, metricDeg)
  const at = (deg: number, length: number): Landmark => ({
    x: 0.5 + (Math.cos((deg * Math.PI) / 180) * length) / aspect,
    y: 0.5 - Math.sin((deg * Math.PI) / 180) * length,
    visibility: 0.99,
  })
  all[iMid] = { x: 0.5, y: 0.5, visibility: 0.99 }
  all[iBase] = at(baseDir, 0.28)
  all[iEnd] = at(endDir, 0.24)
  return all
}

export function createSimulatedTracker(exercise: ExerciseId, side: Side, peakDeg: number, periodMs = 2600): PoseTracker {
  const rest = restFor(exercise) + 4
  const started = performance.now()
  return {
    detect(_video, nowMs) {
      const t = nowMs - started
      // A short pause in view before the first rep, then reps, one per period.
      const phase = t < 900 ? 0 : (1 - Math.cos((2 * Math.PI * (t - 900)) / periodMs)) / 2
      return simulatedLandmarks(exercise, side, rest + (peakDeg - rest) * phase)
    },
    close() {},
  }
}
