import { describe, expect, it } from 'vitest'
import { guideFor, MOTION_WORDS } from './guide'

// Pixels, y down: the shoulder straight above the elbow, the forearm pointing 30 degrees below level.
const cos30 = Math.cos(Math.PI / 6)
const sin30 = Math.sin(Math.PI / 6)
const CURL_AT_60 = [
  [100, 0],
  [100, 100],
  [100 + 80 * cos30, 100 + 80 * sin30],
] as const
const deg = (r: number) => Math.round((r * 180) / Math.PI)

describe('the movement indicator', () => {
  it('points a curl up toward the shoulder, as far as the goal', () => {
    const g = guideFor('elbow_flexion', 'rising', 60, 140, CURL_AT_60)
    expect(g).toMatchObject({ heading: 'goal', atGoal: false, label: 'Curl up' })
    // The forearm is at 30 degrees; 80 more degrees of flexion turn it up to -50 (y down).
    expect(deg(g.arc!.from)).toBe(30)
    expect(deg(g.arc!.to)).toBe(-50)
    expect(deg(g.arc!.goalAt)).toBe(-50)
  })

  it('turns back toward the start once the rep has peaked', () => {
    const g = guideFor('elbow_flexion', 'returning', 60, 140, CURL_AT_60)
    expect(g).toMatchObject({ heading: 'start', label: 'Lower' })
    // Back to the curl's rest (0 degrees of flexion): the forearm turns down to 90.
    expect(deg(g.arc!.to)).toBe(90)
  })

  it('says the goal is reached, and what comes next', () => {
    expect(guideFor('squat', 'rising', 100, 100, CURL_AT_60).label).toBe('Goal · stand up')
    expect(guideFor('squat', 'rising', 60, 100, CURL_AT_60).label).toBe('Sit down')
  })

  it('opens the joint for a movement measured on the inner angle', () => {
    // A knee extension at 120 inner degrees: straightening turns the shin away from the thigh.
    const g = guideFor('seated_knee_extension', 'rising', 120, 175, [[0, 100], [100, 100], [100 + 100 * Math.cos(Math.PI / 3), 100 + 100 * Math.sin(Math.PI / 3)]])
    expect(deg(g.arc!.from)).toBe(60)
    expect(deg(g.arc!.to)).toBe(5)
  })

  it('has no arc for the ab twist, a tilt rather than a joint angle', () => {
    expect(guideFor('ab_twist', 'rising', 10, 30, CURL_AT_60).arc).toBeNull()
  })

  it('has words for every movement', () => {
    for (const [toGoal, back] of Object.values(MOTION_WORDS)) {
      expect(toGoal.length).toBeGreaterThan(0)
      expect(back.length).toBeGreaterThan(0)
    }
  })
})
