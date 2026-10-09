import type { MotionSample, MotionSource } from './types'

/**
 * OWNED BY THE COMPUTER-VISION TEAM. This placeholder keeps the UI working until the real
 * implementation lands. To implement:
 *
 *   1. Open the webcam (getUserMedia; HTTPS or localhost only) and run pose estimation.
 *   2. For the current exercise and side, read `EXERCISES[id].joints[side]` from @ptg/dependencies
 *      to know which three landmarks form the angle, compute the inner angle at the middle
 *      landmark, and pass it through `metricFromInnerAngle`.
 *   3. Call `onSample({ metricDeg, tMs: performance.now(), tracked })` once per frame, with
 *      `tracked: false` whenever a landmark is missing or its visibility is below ~0.5.
 *
 * Everything downstream (smoothing, rep counting, fatigue, saving) is already wired to this
 * interface; see src/hooks/useMotionReps.ts.
 */
export class CameraMotionSource implements MotionSource {
  readonly label = 'Webcam (CV module not implemented yet)'
  private timer: ReturnType<typeof setInterval> | null = null

  start(onSample: (sample: MotionSample) => void): void {
    this.stop()
    console.warn('CameraMotionSource is a placeholder: no pose estimation is running.')
    // Emit "not tracked" so the UI shows its "move into frame" state instead of freezing.
    this.timer = setInterval(() => onSample({ metricDeg: 0, tMs: performance.now(), tracked: false }), 500)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }
}
