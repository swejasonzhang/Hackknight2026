import { describe, expect, it } from 'vitest'
import type { Landmark } from './angle'
import { POSE_CONNECTIONS, visibleJoints, visibleSegments } from './overlay'

const all = (visibility = 0.99): Landmark[] => Array.from({ length: 33 }, (_, i) => ({ x: i / 33, y: 1 - i / 33, visibility }))

describe('the white body skeleton over the camera', () => {
  it("draws MediaPipe's own pose connections, the same white lines the camera app draws", async () => {
    const { PoseLandmarker } = await import('@mediapipe/tasks-vision')
    const theirs = PoseLandmarker.POSE_CONNECTIONS.map((c) => [c.start, c.end].sort((a, b) => a - b).join('-')).sort()
    const ours = POSE_CONNECTIONS.map(([a, b]) => [a, b].sort((x, y) => x - y).join('-')).sort()
    expect(ours).toEqual(theirs)
    expect(POSE_CONNECTIONS).toHaveLength(35)
  })

  it('draws every connection and joint the model can see, head to feet', () => {
    expect(visibleSegments(all())).toHaveLength(35)
    expect(visibleJoints(all())).toHaveLength(33)
  })

  it('leaves out what the model cannot see', () => {
    const landmarks = all()
    landmarks[16] = { x: 0.5, y: 0.5, visibility: 0.2 } // the right wrist, out of view
    const segments = visibleSegments(landmarks)
    // The wrist's five connections go: elbow, pinky, index, thumb, and pinky to index stays.
    expect(segments).toHaveLength(35 - 4)
    expect(visibleJoints(landmarks)).toHaveLength(32)
    expect(visibleSegments(null)).toEqual([])
  })
})
