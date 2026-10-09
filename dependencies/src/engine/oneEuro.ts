/**
 * One Euro filter (Casiez, Roussel and Vogel, CHI 2012): an adaptive low-pass filter that
 * removes jitter when the signal is slow and keeps lag low when it moves fast.
 * Tuning: raise `minCutoff` if the readout feels laggy, raise `beta` if fast motion lags.
 */
export interface OneEuroOptions {
  /** Hz. Lower = smoother at rest, more lag. */
  minCutoff: number
  /** Speed coefficient. Higher = less lag during fast motion. */
  beta: number
  /** Hz. Cutoff for the derivative estimate. */
  dCutoff: number
}

export const DEFAULT_ONE_EURO: OneEuroOptions = { minCutoff: 1.5, beta: 0.02, dCutoff: 1.0 }

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz)
  return 1 / (1 + tau / dtSeconds)
}

export class OneEuroFilter {
  private readonly opts: OneEuroOptions
  private xPrev: number | null = null
  private dxPrev = 0
  private tPrev: number | null = null

  constructor(opts: Partial<OneEuroOptions> = {}) {
    this.opts = { ...DEFAULT_ONE_EURO, ...opts }
  }

  /** Feed one sample; `tMs` must be non-decreasing. Returns the filtered value. */
  filter(x: number, tMs: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x
      this.tPrev = tMs
      this.dxPrev = 0
      return x
    }
    let dt = (tMs - this.tPrev) / 1000
    if (!(dt > 0)) dt = 1 / 30
    const dx = (x - this.xPrev) / dt
    const aD = smoothingFactor(this.opts.dCutoff, dt)
    const edx = aD * dx + (1 - aD) * this.dxPrev
    const cutoff = this.opts.minCutoff + this.opts.beta * Math.abs(edx)
    const a = smoothingFactor(cutoff, dt)
    const xHat = a * x + (1 - a) * this.xPrev
    this.xPrev = xHat
    this.dxPrev = edx
    this.tPrev = tMs
    return xHat
  }

  reset(): void {
    this.xPrev = null
    this.dxPrev = 0
    this.tPrev = null
  }
}
