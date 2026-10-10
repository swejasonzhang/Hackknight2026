import type { ExerciseId } from '@arc/dependencies'
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react'
import { useEffect } from 'react'
import { restFor } from './skeleton'

/** One rep: up from rest, a short hold at the top, back down, then a pause before the next. */
const UP = 1.4
const HOLD = 0.35
const DOWN = 1.2
const PAUSE = 0.7

/**
 * Drives a 3D figure through the whole range of motion, rep after rep: from where the movement
 * starts (rest) to the best rep and back. Returns a Motion value for the scene to follow, the best
 * rep as a fixed number under reduced motion, or null when there is no reading to show.
 */
export function useRepLoop(exercise: ExerciseId, peakDeg: number | null): MotionValue<number> | number | null {
  const reduce = useReducedMotion()
  const rest = restFor(exercise)
  const angle = useMotionValue(rest)

  useEffect(() => {
    if (peakDeg == null || reduce) return
    angle.set(rest)
    const total = UP + HOLD + DOWN
    const controls = animate(angle, [rest, peakDeg, peakDeg, rest], {
      duration: total,
      times: [0, UP / total, (UP + HOLD) / total, 1],
      ease: 'easeInOut',
      repeat: Infinity,
      repeatDelay: PAUSE,
    })
    return () => controls.stop()
    // A new movement always starts from its own rest, even when its rest angle matches the last one's.
  }, [angle, exercise, rest, peakDeg, reduce])

  if (peakDeg == null) return null
  return reduce ? peakDeg : angle
}
