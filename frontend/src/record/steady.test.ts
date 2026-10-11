import { describe, expect, it } from 'vitest'
import { readJoint, type Landmark } from './angle'
import { SessionRecorder } from './recorder'
import { simulatedFrame, simulatedLandmarks } from './simulated'
import { HOLD_MS, SteadyPose } from './steady'

/** A repeatable normal noise source. */
function noise(seed: number) {
  let s = seed
  const uniform = () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    return (s + 0.5) / 2 ** 32
  }
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform())
}

const FPS = 30
const STEP = 1000 / FPS
/** What a webcam's pose model gives: every landmark a few pixels off, a different few every frame. */
function shaken(landmarks: Landmark[], gauss: () => number, sigma = 0.004): Landmark[] {
  return landmarks.map((p) => ({ ...p, x: p.x + gauss() * sigma, y: p.y + gauss() * sigma }))
}
const spread = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
}

describe('SteadyPose', () => {
  it('holds a still arm still: the elbow angle shakes a fraction of what the raw landmarks give', () => {
    const gauss = noise(7)
    const steady = new SteadyPose()
    const raw: number[] = []
    const smooth: number[] = []
    for (let i = 0; i < FPS * 4; i++) {
      const frame = shaken(simulatedLandmarks('elbow_flexion', 'right', 40), gauss)
      const t = i * STEP
      raw.push(readJoint(frame, 'elbow_flexion', 'right', 16 / 9).metricDeg)
      const s = steady.feed({ landmarks: frame, world: null }, t)
      // After the first second, once the filters have settled.
      if (i >= FPS) smooth.push(readJoint(s!.landmarks, 'elbow_flexion', 'right', 16 / 9).metricDeg)
    }
    expect(spread(raw)).toBeGreaterThan(1)
    expect(spread(smooth)).toBeLessThan(spread(raw) / 2.5)
  })

  it('follows a real rep closely: the top of the curl is reached within a few degrees', () => {
    const steady = new SteadyPose()
    let peak = 0
    // One curl, rest to 140° and back, in two seconds.
    for (let i = 0; i <= FPS * 2; i++) {
      const deg = 5 + 135 * (1 - Math.cos((2 * Math.PI * i) / (FPS * 2))) / 2
      const s = steady.feed({ landmarks: simulatedLandmarks('elbow_flexion', 'right', deg), world: null }, i * STEP)
      peak = Math.max(peak, readJoint(s!.landmarks, 'elbow_flexion', 'right', 16 / 9).metricDeg)
    }
    expect(peak).toBeGreaterThan(134)
  })

  it('keeps the joint through a doubtful frame or a missed one, and lets go when the member leaves', () => {
    const steady = new SteadyPose()
    const pose = simulatedLandmarks('elbow_flexion', 'right', 60)
    let t = 0
    for (let i = 0; i < 10; i++) steady.feed({ landmarks: pose, world: null }, (t += STEP))
    // One frame where the model doubts the wrist: still tracked.
    const doubtful = pose.map((p, i) => (i === 16 ? { ...p, visibility: 0.1 } : p))
    expect(readJoint(steady.feed({ landmarks: doubtful, world: null }, (t += STEP))!.landmarks, 'elbow_flexion', 'right').tracked).toBe(true)
    // A frame with nobody found: bridged.
    expect(steady.feed(null, (t += STEP))).not.toBeNull()
    // Gone for longer than a dropout: nobody.
    expect(steady.feed(null, (t += HOLD_MS + 50))).toBeNull()
    // A wrist hidden for a while is let go.
    for (let i = 0; i < 15; i++) steady.feed({ landmarks: doubtful, world: null }, (t += STEP))
    expect(readJoint(steady.feed({ landmarks: doubtful, world: null }, (t += STEP))!.landmarks, 'elbow_flexion', 'right').tracked).toBe(false)
  })

  it('steadies the landmarks in space too, so a shaky set read in 3D counts every rep', () => {
    const gauss = noise(5)
    const steady = new SteadyPose()
    const recorder = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan: { sets: 1, reps: 6, restSeconds: 30, targetDeg: 130 } })
    const period = FPS * 2.4
    const still: number[] = []
    for (let i = 0; i < FPS * 30 && recorder.view.phase !== 'done'; i++) {
      const t = i * STEP
      const deg = i < FPS * 2 ? 5 : 5 + 135 * (1 - Math.cos((2 * Math.PI * (i - FPS * 2)) / period)) / 2
      const frame = simulatedFrame('elbow_flexion', 'right', deg)
      // The model's depth shakes more than its picture: a centimetre or two each frame.
      const world = frame.world!.map((p) => ({ ...p, x: p.x + gauss() * 0.01, y: p.y + gauss() * 0.01, z: (p.z ?? 0) + gauss() * 0.02 }))
      const s = steady.feed({ landmarks: shaken(frame.landmarks, gauss), world }, t)
      const reading = readJoint(s?.landmarks, 'elbow_flexion', 'right', 16 / 9, s?.world)
      if (i >= FPS && i < FPS * 2) still.push(reading.metricDeg)
      recorder.feed({ tracked: reading.tracked, metricDeg: reading.metricDeg, tMs: t, pose: s?.landmarks, aspect: 16 / 9 })
    }
    // Held still, the arm reads within a few degrees.
    expect(spread(still)).toBeLessThan(4)
    expect(recorder.view.phase).toBe('done')
    expect(recorder.completedSets[0]!.reps).toHaveLength(6)
  })

  it('counts every rep of a shaky set, no more and no fewer', () => {
    const gauss = noise(11)
    const steady = new SteadyPose()
    const recorder = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan: { sets: 1, reps: 8, restSeconds: 30, targetDeg: 130 } })
    const period = FPS * 2.4
    for (let i = 0; i < FPS * 30 && recorder.view.phase !== 'done'; i++) {
      const t = i * STEP
      const deg = i < FPS ? 5 : 5 + 135 * (1 - Math.cos((2 * Math.PI * (i - FPS)) / period)) / 2
      const s = steady.feed({ landmarks: shaken(simulatedLandmarks('elbow_flexion', 'right', deg), gauss, 0.006), world: null }, t)
      const reading = readJoint(s?.landmarks, 'elbow_flexion', 'right', 16 / 9)
      recorder.feed({ tracked: reading.tracked, metricDeg: reading.metricDeg, tMs: t, pose: s?.landmarks, aspect: 16 / 9 })
    }
    expect(recorder.view.phase).toBe('done')
    expect(recorder.completedSets[0]!.reps).toHaveLength(8)
    expect(recorder.completedSets[0]!.rejected ?? []).toEqual([])
  })
})
