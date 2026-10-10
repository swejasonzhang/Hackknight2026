import { describe, expect, it } from 'vitest'
import { armPose, clampMetric, DISTAL } from './armPose'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe('armPose', () => {
  it('elbow flexion: 0° hangs the forearm straight down, 90° points it forward, 140° brings the hand up', () => {
    const rest = armPose('elbow_flexion', 0)
    close(rest.end[0], rest.mid[0])
    close(rest.end[1], rest.mid[1] - DISTAL)
    expect(rest.innerDeg).toBe(180)

    const square = armPose('elbow_flexion', 90)
    close(square.end[0], square.mid[0] + DISTAL)
    close(square.end[1], square.mid[1])
    expect(square.innerDeg).toBe(90)

    const goal = armPose('elbow_flexion', 140)
    expect(goal.end[1]).toBeGreaterThan(goal.mid[1])
    expect(goal.end[0]).toBeGreaterThan(goal.mid[0])
    expect(goal.innerDeg).toBe(40)
  })

  it('shoulder abduction: the arm hangs at 0° and is level at 90°', () => {
    const down = armPose('shoulder_abduction', 0)
    close(down.end[1], down.mid[1] - DISTAL)
    const level = armPose('shoulder_abduction', 90)
    close(level.end[0], level.mid[0] + DISTAL)
    close(level.end[1], level.mid[1])
    expect(level.landmarks).toEqual(['hip', 'shoulder', 'elbow'])
  })

  it('seated knee extension: the shin hangs at 90° and lines up with the thigh at 180°', () => {
    const bent = armPose('seated_knee_extension', 90)
    close(bent.end[0], bent.mid[0])
    close(bent.end[1], bent.mid[1] - DISTAL)
    const straight = armPose('seated_knee_extension', 180)
    close(straight.end[0], straight.mid[0] + DISTAL)
    close(straight.end[1], straight.mid[1])
    expect(straight.innerDeg).toBe(180)
  })

  it('clamps the metric to what the gauge can show and keeps the gauge start fixed', () => {
    expect(clampMetric('elbow_flexion', -20)).toBe(0)
    expect(clampMetric('elbow_flexion', 500)).toBe(180)
    expect(clampMetric('seated_knee_extension', 10)).toBe(90)
    for (const ex of ['elbow_flexion', 'shoulder_abduction', 'seated_knee_extension'] as const) {
      expect(armPose(ex, 120).gaugeFromDeg).toBe(-90)
      expect(armPose(ex, 150).distalDeg).toBeGreaterThan(armPose(ex, 120).distalDeg)
    }
  })
})
