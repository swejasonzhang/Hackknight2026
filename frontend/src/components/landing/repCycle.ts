export interface RepEvent {
  rep: number
  completed: boolean
  peak?: number
}

/**
 * Hysteresis rep detector for the hero animation: a rep completes when the angle has
 * passed `top` and then returns to `bottom`. Mirrors the real engine's counter in miniature.
 */
export function createRepCycle({ top, bottom }: { top: number; bottom: number }) {
  let armed = false
  let reps = 0
  let peak = -Infinity
  return {
    feed(angle: number): RepEvent {
      if (angle >= top) {
        armed = true
        peak = Math.max(peak, angle)
      } else if (armed) {
        peak = Math.max(peak, angle)
        if (angle <= bottom) {
          reps += 1
          const completedPeak = peak
          armed = false
          peak = -Infinity
          return { rep: reps, completed: true, peak: completedPeak }
        }
      }
      return { rep: reps, completed: false }
    },
    reset() {
      armed = false
      reps = 0
      peak = -Infinity
    },
  }
}
