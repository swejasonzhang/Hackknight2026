import { EXERCISES, type ExerciseId, type Side } from '@arc/dependencies'
import { LANDMARK_OF, restFor, skeletonFor, type JointName } from '../components/three/skeleton'
import type { Landmark } from './angle'
import type { PoseTracker } from './pose'

/** The same joint on the other side of the body. */
const other = (name: JointName): JointName => (name.startsWith('r') ? `l${name.slice(1)}` : `r${name.slice(1)}`) as JointName

/** The middle of the body at rest, so the pretend person stands in the middle of the picture. */
const centres = new Map<string, [number, number]>()
function centreOf(exercise: ExerciseId, mirror: number): [number, number] {
  const key = `${exercise}${mirror}`
  let c = centres.get(key)
  if (!c) {
    const rest = Object.values(skeletonFor(exercise, restFor(exercise)).joints)
    const xs = rest.map((p) => p[0] * mirror)
    const ys = rest.map((p) => p[1])
    c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
    centres.set(key, c)
  }
  return c
}

/**
 * Development only (`/record?simulate`): a pretend person doing reps from rest to `peakDeg` and
 * back, one every `periodMs`. Its landmarks are the 3D figure's own joints for the reading, seen
 * by the camera (the figure works its right side; for the left side it is mirrored, so the left
 * landmarks do the work), which keeps the tracker, the figure and the simulator in agreement for
 * every movement. It exercises the whole record → count → rest → save path without a camera.
 */
export function simulatedLandmarks(exercise: ExerciseId, side: Side, metricDeg: number, aspect = 16 / 9): Landmark[] {
  const all: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }))
  const { joints, overlay } = skeletonFor(exercise, metricDeg)
  const mirror = side === 'left' ? -1 : 1
  const [cx, cy] = centreOf(exercise, mirror)
  const k = 0.11 // frame heights per body unit: a standing body fills about two thirds of the picture
  const seen = ([x, y]: [number, number]): Landmark => ({ x: 0.5 + ((x * mirror - cx) * k) / aspect, y: 0.5 - (y - cy) * k, visibility: 0.99 })
  for (const [name, index] of Object.entries(LANDMARK_OF) as [JointName, number][]) {
    const [x, y] = joints[side === 'left' ? other(name) : name]
    all[index] = seen([x, y])
  }
  // The measured landmarks sit where the goniometer does: the shoulder movements measure from
  // the trunk line, so the pretend hip sits under the shoulder, as for a person standing square.
  const cfg = EXERCISES[exercise]
  if (cfg.measure !== 'tilt') {
    const [iBase, iMid, iEnd] = cfg.joints[side]
    all[iBase] = seen(overlay.base)
    all[iMid] = seen(overlay.mid)
    all[iEnd] = seen(overlay.end)
  }
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
