import type { RepRecord } from './types'

export interface RepCounterConfig {
  /** Metric value that marks the top of a rep. */
  enterDeg: number
  /** Metric value the patient must return to before the rep counts. Must be < enterDeg. */
  exitDeg: number
  /** Reps shorter than this (ms) are ignored as jitter. */
  minRepMs: number
}

/**
 * rest      -> metric at or below exitDeg
 * rising    -> left the rest zone, has not reached enterDeg yet
 * peak      -> reached enterDeg (the rep will count once it returns to exitDeg)
 * returning -> past the peak and on the way down (UI cue only)
 */
export type RepPhase = 'rest' | 'rising' | 'peak' | 'returning'

export interface RepCounterSnapshot {
  phase: RepPhase
  count: number
  /** Movements that left the rest zone but never reached enterDeg. */
  partials: number
  peakDeg: number | null
  repStartedAt: number | null
}

/**
 * Hysteresis rep counter. A rep = leave the rest zone, reach enterDeg, return to exitDeg.
 * The two thresholds stop a wobble around a single line from counting twice, and
 * minRepMs rejects landmark flicker.
 */
export class RepCounter {
  private readonly cfg: RepCounterConfig
  private phase: RepPhase = 'rest'
  private count = 0
  private partials = 0
  private peak = -Infinity
  private startedAt: number | null = null

  constructor(cfg: RepCounterConfig) {
    if (!(cfg.enterDeg > cfg.exitDeg)) throw new Error('enterDeg must be greater than exitDeg')
    this.cfg = cfg
  }

  get snapshot(): RepCounterSnapshot {
    return {
      phase: this.phase,
      count: this.count,
      partials: this.partials,
      peakDeg: this.phase === 'rest' ? null : this.peak,
      repStartedAt: this.startedAt,
    }
  }

  reset(): void {
    this.phase = 'rest'
    this.count = 0
    this.partials = 0
    this.toRest()
  }

  private toRest(): void {
    this.phase = 'rest'
    this.peak = -Infinity
    this.startedAt = null
  }

  /** Feed one (smoothed) metric sample. Returns a RepRecord when a rep completes. */
  update(deg: number, tMs: number): RepRecord | null {
    const { enterDeg, exitDeg, minRepMs } = this.cfg
    switch (this.phase) {
      case 'rest':
        if (deg > exitDeg) {
          this.phase = 'rising'
          this.startedAt = tMs
          this.peak = deg
        }
        return null
      case 'rising':
        if (deg > this.peak) this.peak = deg
        if (deg >= enterDeg) {
          this.phase = 'peak'
        } else if (deg <= exitDeg) {
          // Came back down without reaching the top: a partial if it got at least halfway.
          if (this.peak >= (enterDeg + exitDeg) / 2) this.partials++
          this.toRest()
        }
        return null
      case 'peak':
      case 'returning': {
        if (deg > this.peak) {
          this.peak = deg
          this.phase = 'peak'
        } else if (deg < this.peak - 10) {
          this.phase = 'returning'
        }
        if (deg > exitDeg) return null
        const startedAt = this.startedAt ?? tMs
        const peakDeg = this.peak
        this.toRest()
        const durationMs = tMs - startedAt
        if (durationMs < minRepMs) return null
        this.count++
        return { index: this.count, peakDeg, startedAt, endedAt: tMs, durationMs }
      }
    }
    return null
  }
}
