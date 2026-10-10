import { estimateFatigue, EXERCISES, OneEuroFilter, RepCounter, type CreateSessionInput, type ExerciseId, type RepPhase, type RepRecord, type SessionEvent, type SessionPlan, type SetRecord, type Side, type VoiceCommand } from '@arc/dependencies'

/** How long the joint must stay in view before the first set starts. */
export const READY_MS = 600

export type RecorderPhase = 'waiting' | 'active' | 'rest' | 'done'

export interface RecorderSample {
  tracked: boolean
  metricDeg: number
  /** Milliseconds since the epoch (the page passes performance.timeOrigin + performance.now()). */
  tMs: number
}

export interface RecorderView {
  phase: RecorderPhase
  setNumber: number
  setsPlanned: number
  repsInSet: number
  repsPlanned: number
  totalReps: number
  restLeftMs: number
  /** Paused by voice: nothing counts and the rest countdown is frozen. */
  paused: boolean
  tracked: boolean
  /** The smoothed metric now, or null before the joint has been seen. */
  metricDeg: number | null
  repPhase: RepPhase
  bestDeg: number | null
  lastRep: RepRecord | null
}

interface Config {
  exercise: ExerciseId
  side: Side
  plan: SessionPlan
}

/**
 * A recording session in the browser, frame by frame, with nothing to press: it waits until the
 * exercise's joint has been in view for a moment, counts the plan's sets with the shared rep
 * counter (smoothed by the One Euro filter), runs the rest between sets by itself, and finishes
 * after the last set (or early, keeping what was done). `toSessionInput` is the body for
 * POST /api/sessions; the server recomputes fatigue and the summary from the reps.
 */
export class SessionRecorder {
  private readonly cfg: Config
  private phase: RecorderPhase = 'waiting'
  private trackedSince: number | null = null
  private setNumber = 1
  private setStartedAt = 0
  private reps: RepRecord[] = []
  private readonly sets: SetRecord[] = []
  private restEndsAt = 0
  private startedAt: number | null = null
  private endedAt: number | null = null
  private filter = new OneEuroFilter()
  private counter: RepCounter
  private smoothed: number | null = null
  private tracked = false
  private best: number | null = null
  private lastRep: RepRecord | null = null
  private lastT = 0
  private paused = false
  private pausedRestLeft: number | null = null
  private readonly events: SessionEvent[] = []

  constructor(cfg: Config) {
    this.cfg = cfg
    this.counter = this.newCounter()
  }

  private newCounter(): RepCounter {
    const { enterDeg, exitDeg, minRepMs } = EXERCISES[this.cfg.exercise]
    return new RepCounter({ enterDeg, exitDeg, minRepMs })
  }

  private startSet(tMs: number): void {
    this.phase = 'active'
    this.setStartedAt = tMs
    this.reps = []
    this.counter = this.newCounter()
    this.filter = new OneEuroFilter()
    this.startedAt ??= tMs
  }

  private closeSet(tMs: number, endedEarly: boolean): void {
    if (this.reps.length === 0) return
    this.sets.push({ setNumber: this.setNumber, reps: this.reps, fatigue: estimateFatigue(this.reps), startedAt: this.setStartedAt, endedAt: tMs, endedEarly })
    this.reps = []
  }

  /** The set is over (its reps are in, or it was cut short): rest, or done after the last one. */
  private endSet(tMs: number, endedEarly: boolean): void {
    this.closeSet(tMs, endedEarly)
    if (this.setNumber >= this.cfg.plan.sets) {
      this.phase = 'done'
      this.endedAt = tMs
    } else {
      this.phase = 'rest'
      this.restEndsAt = tMs + this.cfg.plan.restSeconds * 1000
    }
  }

  /**
   * A voice command (or its button): start counting now, pause and resume (the rest countdown
   * freezes too), skip (cut the set short, or skip the rest), rest (end the set now), stop (finish).
   * Every command is kept with its time and saved with the session.
   */
  command(command: VoiceCommand, rawT: number): RecorderView {
    const tMs = Math.round(rawT)
    this.events.push({ at: tMs, command })
    if (this.phase === 'done') return this.view
    switch (command) {
      case 'start':
        if (this.paused) this.resume(tMs)
        else if (this.phase === 'waiting') this.startSet(tMs)
        break
      case 'pause':
        if (this.paused) break
        this.paused = true
        if (this.phase === 'rest') this.pausedRestLeft = Math.max(0, this.restEndsAt - tMs)
        break
      case 'resume':
        this.resume(tMs)
        break
      case 'skip':
        this.paused = false
        if (this.phase === 'active') this.endSet(tMs, true)
        else if (this.phase === 'rest') {
          this.setNumber++
          this.startSet(tMs)
        } else if (this.phase === 'waiting') this.startSet(tMs)
        break
      case 'rest':
        if (this.phase === 'active') {
          this.paused = false
          this.endSet(tMs, true)
        }
        break
      case 'stop':
        this.finish(tMs)
        break
      case 'status':
      case 'repeat':
        break
    }
    return this.view
  }

  private resume(tMs: number): void {
    if (!this.paused) return
    this.paused = false
    if (this.phase === 'rest' && this.pausedRestLeft != null) this.restEndsAt = tMs + this.pausedRestLeft
    this.pausedRestLeft = null
    // A rep half-done before the pause should not count after it.
    this.counter = this.newCounter()
    this.filter = new OneEuroFilter()
  }

  feed({ tracked, metricDeg, tMs: rawT }: RecorderSample): RecorderView {
    // The browser clock has fractions of a millisecond; sessions store whole milliseconds.
    const tMs = Math.round(rawT)
    this.lastT = tMs
    this.tracked = tracked
    if (this.paused) return this.view
    if (tracked) this.smoothed = this.filter.filter(metricDeg, tMs)

    switch (this.phase) {
      case 'waiting':
        if (!tracked) this.trackedSince = null
        else if (this.trackedSince == null) this.trackedSince = tMs
        else if (tMs - this.trackedSince >= READY_MS) this.startSet(tMs)
        break
      case 'active': {
        if (!tracked || this.smoothed == null) break
        const rep = this.counter.update(this.smoothed, tMs)
        if (!rep) break
        this.reps.push(rep)
        this.lastRep = rep
        this.best = Math.max(this.best ?? -Infinity, rep.peakDeg)
        if (this.reps.length >= this.cfg.plan.reps) this.endSet(tMs, false)
        break
      }
      case 'rest':
        if (tMs >= this.restEndsAt) {
          this.setNumber++
          this.startSet(tMs)
        }
        break
      case 'done':
        break
    }
    return this.view
  }

  /** End now, keeping the reps of an unfinished set (marked as ended early). */
  finish(rawT: number): void {
    const tMs = Math.round(rawT)
    if (this.phase === 'done') return
    if (this.phase === 'active') this.closeSet(tMs, true)
    this.phase = 'done'
    this.endedAt = tMs
  }

  get view(): RecorderView {
    const counted = this.sets.reduce((n, s) => n + s.reps.length, 0) + this.reps.length
    return {
      phase: this.phase,
      setNumber: this.setNumber,
      setsPlanned: this.cfg.plan.sets,
      repsInSet: this.phase === 'rest' || this.phase === 'done' ? (this.sets.at(-1)?.reps.length ?? 0) : this.reps.length,
      repsPlanned: this.cfg.plan.reps,
      totalReps: counted,
      restLeftMs: this.phase === 'rest' ? (this.paused && this.pausedRestLeft != null ? this.pausedRestLeft : Math.max(0, this.restEndsAt - this.lastT)) : 0,
      paused: this.paused,
      tracked: this.tracked,
      metricDeg: this.smoothed,
      repPhase: this.counter.snapshot.phase,
      bestDeg: this.best,
      lastRep: this.lastRep,
    }
  }

  /** The sets finished so far, in order. */
  get completedSets(): readonly SetRecord[] {
    return this.sets
  }

  /** The body for POST /api/sessions, or null when no rep was counted. */
  toSessionInput(profileId: string): CreateSessionInput | null {
    if (this.sets.length === 0 || this.startedAt == null) return null
    return {
      profileId,
      exercise: this.cfg.exercise,
      side: this.cfg.side,
      startedAt: this.startedAt,
      endedAt: this.endedAt ?? this.lastT,
      plan: this.cfg.plan,
      sets: this.sets,
      ...(this.events.length ? { events: this.events } : {}),
    }
  }
}
