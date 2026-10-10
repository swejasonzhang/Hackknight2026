import { EXERCISES, type RepRecord } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { cueFor, shouldCue } from './cues'

const curl = EXERCISES.elbow_flexion // rest 0, goal 140, minRepMs 800
const reps = (peaks: number[], durationMs = 2200): RepRecord[] => peaks.map((peakDeg, i) => ({ index: i + 1, peakDeg, startedAt: i * 3000, endedAt: i * 3000 + durationMs, durationMs }))

describe('a cue from Arc after a rep', () => {
  it('asks for more depth when a rep falls well short of the goal', () => {
    expect(cueFor(reps([110]), curl, 140)).toBe('Go a little deeper.')
  })

  it('notices the range fading through a set before anything else', () => {
    expect(cueFor(reps([138, 136, 120]), curl, 140)).toBe('Your range is fading. Slow it down and finish each rep.')
  })

  it('slows down a rushed rep', () => {
    expect(cueFor(reps([137], 900), curl, 140)).toBe('Slow down, lower it with control.')
  })

  it('praises the first rep that reaches the goal, then lets good reps be', () => {
    expect(cueFor(reps([132, 141]), curl, 140)).toBe("That's the depth. Keep it there.")
    expect(cueFor(reps([141, 142]), curl, 140)).toBeNull()
    expect(cueFor([], curl, 140)).toBeNull()
  })

  it('speaks at most every few seconds and never over Arc', () => {
    expect(shouldCue({ now: 20_000, lastCueAt: 0, arcSpeaking: false })).toBe(true)
    expect(shouldCue({ now: 5_000, lastCueAt: 0, arcSpeaking: false })).toBe(false)
    expect(shouldCue({ now: 20_000, lastCueAt: 0, arcSpeaking: true })).toBe(false)
  })
})
