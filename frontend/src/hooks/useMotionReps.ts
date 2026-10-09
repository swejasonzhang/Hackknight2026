import { OneEuroFilter, RepCounter, type ExerciseConfig, type RepPhase, type RepRecord } from '@ptg/dependencies'
import { useEffect, useRef, useState } from 'react'
import type { MotionSource } from '../motion/types'

export interface LiveReadout {
  metricDeg: number | null
  phase: RepPhase
  tracked: boolean
  count: number
}

const UNTRACKED: LiveReadout = { metricDeg: null, phase: 'rest', tracked: false, count: 0 }

export interface UseMotionRepsOptions {
  /** Count reps only while true (the session is in its active phase and not paused). */
  counting: boolean
  /** Change this value to reset the counter (one value per set). */
  resetKey: number
  /** Called with epoch-ms timestamps, ready to store. */
  onRep: (rep: RepRecord) => void
}

/**
 * Connects any MotionSource to the shared engine: smooths the angle with a One Euro filter,
 * runs the hysteresis rep counter, and reports a throttled live readout for the UI.
 */
export function useMotionReps(source: MotionSource | null, exercise: ExerciseConfig, opts: UseMotionRepsOptions): LiveReadout {
  const [readout, setReadout] = useState<LiveReadout>(UNTRACKED)
  const countingRef = useRef(opts.counting)
  const onRepRef = useRef(opts.onRep)
  const counterRef = useRef<RepCounter | null>(null)
  countingRef.current = opts.counting
  onRepRef.current = opts.onRep

  useEffect(() => {
    counterRef.current?.reset()
  }, [opts.resetKey])

  useEffect(() => {
    if (!source) {
      setReadout(UNTRACKED)
      return
    }
    const filter = new OneEuroFilter()
    const counter = new RepCounter(exercise)
    counterRef.current = counter
    let lastUiUpdate = -Infinity

    source.start((sample) => {
      if (!sample.tracked) {
        filter.reset()
        setReadout((r) => (r.tracked ? { ...r, tracked: false, metricDeg: null } : r))
        return
      }
      const smoothed = filter.filter(sample.metricDeg, sample.tMs)
      if (countingRef.current) {
        const rep = counter.update(smoothed, sample.tMs)
        if (rep) {
          const endedAt = Date.now()
          onRepRef.current({ ...rep, endedAt, startedAt: endedAt - rep.durationMs })
        }
      }
      if (sample.tMs - lastUiUpdate >= 100) {
        lastUiUpdate = sample.tMs
        const snap = counter.snapshot
        setReadout({ metricDeg: smoothed, phase: snap.phase, tracked: true, count: snap.count })
      }
    })
    return () => {
      source.stop()
      counterRef.current = null
    }
  }, [source, exercise])

  return readout
}
