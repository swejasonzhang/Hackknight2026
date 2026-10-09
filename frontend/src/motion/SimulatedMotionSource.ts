import type { MotionSample, MotionSource } from './types'

export interface SimulatedMotionOptions {
  /** Time for one full rep (rest -> peak -> rest). */
  periodMs: number
  /** Metric at rest. */
  restDeg: number
  /** Metric at the top of the first rep. */
  peakDeg: number
  /** Degrees lost per completed rep: simulates shrinking range. Default 0. */
  peakDecayPerRep?: number
  /** Milliseconds added to the period per completed rep: simulates slowing tempo. Default 0. */
  slowdownPerRep?: number
  /** Sampling interval. Default 50 ms (20 fps). */
  sampleMs?: number
}

/**
 * Stand-in for the webcam so the whole session flow can be built and demoed without the
 * computer-vision module. Emits a smooth cosine rep cycle on a synthetic clock that starts
 * at 0 when `start()` is called.
 */
export class SimulatedMotionSource implements MotionSource {
  readonly label = 'Simulated user'
  private readonly opts: SimulatedMotionOptions
  private timer: ReturnType<typeof setInterval> | null = null
  private elapsed = 0
  private repsDone = 0
  private repStart = 0
  private period = 0

  constructor(opts: SimulatedMotionOptions) {
    this.opts = opts
  }

  start(onSample: (sample: MotionSample) => void): void {
    this.stop()
    const { restDeg, peakDeg } = this.opts
    const decay = this.opts.peakDecayPerRep ?? 0
    const slowdown = this.opts.slowdownPerRep ?? 0
    const step = this.opts.sampleMs ?? 50
    this.elapsed = 0
    this.repsDone = 0
    this.repStart = 0
    this.period = this.opts.periodMs

    this.timer = setInterval(() => {
      const t = this.elapsed
      this.elapsed += step
      let phase = (t - this.repStart) / this.period
      if (phase >= 1) {
        this.repsDone += 1
        this.repStart += this.period
        this.period += slowdown
        phase = (t - this.repStart) / this.period
      }
      const amplitude = Math.max(0, peakDeg - restDeg - decay * this.repsDone)
      const metricDeg = restDeg + amplitude * 0.5 * (1 - Math.cos(2 * Math.PI * phase))
      onSample({ metricDeg, tMs: t, tracked: true })
    }, step)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }
}
