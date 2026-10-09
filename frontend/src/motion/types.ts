/**
 * The boundary between the computer-vision module and everything else.
 *
 * A MotionSource emits one MotionSample per frame for the joint of the current exercise.
 * `metricDeg` is already converted with ExerciseConfig.metricFromInnerAngle (see @ptg/dependencies),
 * so "more degrees" always means "deeper into the rep". The rep counter, the fatigue
 * proxy, the session flow and the dashboard never see landmarks or video.
 */
export interface MotionSample {
  /** Exercise metric in degrees. Ignored when `tracked` is false. */
  metricDeg: number
  /** Milliseconds on any monotonic clock (performance.now() or a synthetic clock). */
  tMs: number
  /** False when the joint is not visible or confidence is too low. */
  tracked: boolean
}

export interface MotionSource {
  /** Human-readable name shown in the UI. */
  readonly label: string
  start(onSample: (sample: MotionSample) => void): void
  stop(): void
}
