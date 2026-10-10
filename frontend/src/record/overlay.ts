import type { Landmark } from './angle'

/**
 * MediaPipe Pose's 35 connections between its 33 landmarks (face, shoulders, arms, hands, hips,
 * legs, feet): the white skeleton the camera app draws with `mp_drawing.draw_landmarks`, so the
 * browser shows the same lines. Kept here rather than read from the pose library, which loads
 * only once recording starts; a test checks it against the library's own list.
 */
export const POSE_CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
]

/** Below this the model is guessing; nothing is drawn there. */
const SEEN = 0.5
const seen = (p: Landmark | undefined): p is Landmark => !!p && (p.visibility ?? 1) >= SEEN

/** The connections whose two landmarks the model can see, as pairs of landmarks. */
export function visibleSegments(landmarks: readonly Landmark[] | null | undefined): [Landmark, Landmark][] {
  if (!landmarks) return []
  const out: [Landmark, Landmark][] = []
  for (const [a, b] of POSE_CONNECTIONS) {
    const p = landmarks[a]
    const q = landmarks[b]
    if (seen(p) && seen(q)) out.push([p, q])
  }
  return out
}

/** The landmarks the model can see. */
export function visibleJoints(landmarks: readonly Landmark[] | null | undefined): Landmark[] {
  return landmarks ? landmarks.filter(seen) : []
}
