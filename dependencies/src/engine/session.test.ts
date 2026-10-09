import { describe, expect, it } from 'vitest'
import { createInitialState, restSecondsLeft, sessionReducer, summarizeSets, type SessionState } from './session.ts'
import type { RepRecord } from './types.ts'

const rep = (peakDeg: number, now: number, durationMs = 2000): RepRecord => ({
  index: 0,
  peakDeg,
  startedAt: now - durationMs,
  endedAt: now,
  durationMs,
})

function run(state: SessionState, peaks: number[], startNow: number, stepMs = 2500): { state: SessionState; now: number } {
  let now = startNow
  for (const p of peaks) {
    state = sessionReducer(state, { type: 'rep', rep: rep(p, now), now })
    now += stepMs
  }
  return { state, now }
}

describe('sessionReducer', () => {
  it('starts idle with the exercise default plan', () => {
    const s = createInitialState('elbow_flexion', 'right')
    expect(s.phase).toBe('idle')
    expect(s.plan).toEqual({ sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 })
  })

  it('configure only works while idle and resets the plan when the exercise changes', () => {
    let s = createInitialState('elbow_flexion', 'right', { reps: 12 })
    s = sessionReducer(s, { type: 'configure', exercise: 'seated_knee_extension', side: 'left' })
    expect(s.plan.targetDeg).toBe(175)
    expect(s.plan.reps).toBe(8)
    expect(s.side).toBe('left')
    s = sessionReducer(s, { type: 'start', now: 0 })
    const after = sessionReducer(s, { type: 'configure', exercise: 'elbow_flexion' })
    expect(after).toBe(s)
  })

  it('walks idle -> align -> active -> rest -> align -> active -> complete', () => {
    let s = createInitialState('elbow_flexion', 'right', { sets: 2, reps: 3, restSeconds: 10 })
    s = sessionReducer(s, { type: 'start', now: 1000 })
    expect(s.phase).toBe('align')
    expect(s.sessionStartedAt).toBe(1000)
    s = sessionReducer(s, { type: 'aligned', now: 2000 })
    expect(s.phase).toBe('active')
    expect(s.setStartedAt).toBe(2000)

    let r = run(s, [120, 121, 119], 5000)
    s = r.state
    expect(s.phase).toBe('rest')
    expect(s.completedSets).toHaveLength(1)
    expect(s.completedSets[0]!.reps.map((x) => x.index)).toEqual([1, 2, 3])
    expect(s.completedSets[0]!.endedEarly).toBe(false)
    expect(restSecondsLeft(s)).toBe(10)
    const restStart = s.completedSets[0]!.endedAt

    // 4 s into rest
    s = sessionReducer(s, { type: 'tick', now: restStart + 4000 })
    expect(restSecondsLeft(s)).toBe(6)
    // rest over
    s = sessionReducer(s, { type: 'tick', now: restStart + 11000 })
    expect(s.phase).toBe('align')
    expect(s.currentSet).toBe(2)

    s = sessionReducer(s, { type: 'aligned', now: restStart + 12000 })
    r = run(s, [118, 117, 116], restStart + 13000)
    s = r.state
    expect(s.phase).toBe('complete')
    expect(s.completedSets).toHaveLength(2)
  })

  it('ignores reps while paused and while not active', () => {
    let s = createInitialState('elbow_flexion', 'right')
    const idleRep = sessionReducer(s, { type: 'rep', rep: rep(120, 10), now: 10 })
    expect(idleRep.currentReps).toHaveLength(0)
    s = sessionReducer(s, { type: 'start', now: 0 })
    s = sessionReducer(s, { type: 'aligned', now: 0 })
    s = sessionReducer(s, { type: 'pause', now: 100 })
    s = sessionReducer(s, { type: 'rep', rep: rep(120, 200), now: 200 })
    expect(s.currentReps).toHaveLength(0)
    s = sessionReducer(s, { type: 'resume', now: 300 })
    s = sessionReducer(s, { type: 'rep', rep: rep(120, 400), now: 400 })
    expect(s.currentReps).toHaveLength(1)
  })

  it('pausing during rest freezes the countdown', () => {
    let s = createInitialState('elbow_flexion', 'right', { sets: 2, reps: 1, restSeconds: 30 })
    s = sessionReducer(s, { type: 'start', now: 0 })
    s = sessionReducer(s, { type: 'aligned', now: 0 })
    s = sessionReducer(s, { type: 'rep', rep: rep(120, 3000), now: 3000 })
    expect(s.phase).toBe('rest')
    s = sessionReducer(s, { type: 'tick', now: 8000 }) // 25 s left
    s = sessionReducer(s, { type: 'pause', now: 8000 })
    s = sessionReducer(s, { type: 'tick', now: 60000 })
    expect(s.phase).toBe('rest')
    expect(restSecondsLeft(s)).toBe(25)
    s = sessionReducer(s, { type: 'resume', now: 60000 })
    s = sessionReducer(s, { type: 'tick', now: 70000 })
    expect(restSecondsLeft(s)).toBe(15)
  })

  it('skipRest and endSet move the session along manually', () => {
    let s = createInitialState('elbow_flexion', 'right', { sets: 3, reps: 5, restSeconds: 30 })
    s = sessionReducer(s, { type: 'start', now: 0 })
    s = sessionReducer(s, { type: 'aligned', now: 0 })
    s = run(s, [120, 120], 1000).state
    s = sessionReducer(s, { type: 'endSet', now: 9000 })
    expect(s.phase).toBe('rest')
    expect(s.completedSets[0]!.endedEarly).toBe(true)
    expect(s.completedSets[0]!.reps).toHaveLength(2)
    s = sessionReducer(s, { type: 'skipRest', now: 9500 })
    expect(s.phase).toBe('align')
    expect(s.currentSet).toBe(2)
  })

  it('ends a set early and explains why when the fatigue proxy crosses the stop line', () => {
    let s = createInitialState('elbow_flexion', 'right', { sets: 2, reps: 12, restSeconds: 30 })
    s = sessionReducer(s, { type: 'start', now: 0 })
    s = sessionReducer(s, { type: 'aligned', now: 0 })
    // 3 strong reps, then collapsing range: 60 % drop -> index well above 0.25
    s = run(s, [130, 130, 130, 60, 50, 50], 1000).state
    expect(s.phase).toBe('rest')
    expect(s.completedSets[0]!.endedEarly).toBe(true)
    expect(s.completedSets[0]!.reps.length).toBeLessThan(12)
    expect(s.nudge?.text).toMatch(/Resting early/)
  })

  it('nudges, without stopping, when range starts to shrink', () => {
    let s = createInitialState('elbow_flexion', 'right', { sets: 1, reps: 12, restSeconds: 30 })
    s = sessionReducer(s, { type: 'start', now: 0 })
    s = sessionReducer(s, { type: 'aligned', now: 0 })
    // first two mean 130, last two mean 100 -> 23 % decay -> index 0.14 (nudge, below stop)
    s = run(s, [130, 130, 100, 100], 1000).state
    expect(s.phase).toBe('active')
    expect(s.nudge?.text).toMatch(/full range/)
  })

  it('applies a plan adjustment with clamping and keeps the reason as a nudge', () => {
    let s = createInitialState('elbow_flexion', 'right')
    s = sessionReducer(s, {
      type: 'applyAdjustment',
      adjustment: { reps: 6, restSeconds: 5, targetDeg: 999, reason: 'Shorter sets today' },
      now: 10,
    })
    expect(s.plan).toEqual({ sets: 3, reps: 6, restSeconds: 10, targetDeg: 180 })
    expect(s.nudge?.text).toBe('Shorter sets today')
  })

  it('reset returns to idle keeping exercise, side and plan', () => {
    let s = createInitialState('shoulder_abduction', 'left', { reps: 5 })
    s = sessionReducer(s, { type: 'start', now: 0 })
    s = sessionReducer(s, { type: 'reset' })
    expect(s.phase).toBe('idle')
    expect(s.exercise).toBe('shoulder_abduction')
    expect(s.plan.reps).toBe(5)
    expect(s.completedSets).toHaveLength(0)
  })
})

describe('summarizeSets', () => {
  it('aggregates reps across sets', () => {
    let s = createInitialState('elbow_flexion', 'right', { sets: 2, reps: 4, restSeconds: 10 })
    s = sessionReducer(s, { type: 'start', now: 0 })
    s = sessionReducer(s, { type: 'aligned', now: 0 })
    let r = run(s, [120, 120, 110, 110], 1000)
    s = sessionReducer(r.state, { type: 'skipRest', now: r.now })
    s = sessionReducer(s, { type: 'aligned', now: r.now })
    r = run(s, [100, 100, 100, 100], r.now + 1000)
    const summary = summarizeSets(r.state.completedSets)
    expect(summary.totalReps).toBe(8)
    expect(summary.bestPeakDeg).toBe(120)
    expect(summary.meanPeakDeg).toBeCloseTo(107.5, 5)
    // set 1: 10 deg drop of 120 -> 0.05 index; set 2: 0 -> mean 0.025
    expect(summary.fatigueIndex).toBeCloseTo(0.025, 5)
  })

  it('is all zeros with no sets', () => {
    expect(summarizeSets([])).toEqual({ totalReps: 0, bestPeakDeg: 0, meanPeakDeg: 0, fatigueIndex: 0 })
  })
})
