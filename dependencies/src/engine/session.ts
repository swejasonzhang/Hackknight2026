import { EXERCISES } from './exercises.ts'
import { estimateFatigue, FATIGUE_MIN_REPS, FATIGUE_NUDGE, FATIGUE_STOP } from './fatigue.ts'
import type { ExerciseId, RepRecord, SessionPlan, SessionSummary, SetRecord, Side } from './types.ts'

/**
 * idle -> align -> active -> rest -> align -> active ... -> complete
 * Pause is a flag: counting and the rest countdown both stop while paused.
 * The reducer is pure and takes `now` from the caller, so it is fully unit-testable.
 */
export type SessionPhase = 'idle' | 'align' | 'active' | 'rest' | 'complete'

export interface Nudge {
  text: string
  at: number
}

export interface SessionState {
  exercise: ExerciseId
  side: Side
  plan: SessionPlan
  phase: SessionPhase
  paused: boolean
  /** 1-based number of the set in progress (or about to start). */
  currentSet: number
  completedSets: SetRecord[]
  currentReps: RepRecord[]
  setStartedAt: number | null
  sessionStartedAt: number | null
  restRemainingMs: number
  restLastTickAt: number | null
  nudge: Nudge | null
}

/** What the user (or a future assistant) may change between sets. */
export interface PlanAdjustment {
  reps?: number | null
  sets?: number | null
  restSeconds?: number | null
  targetDeg?: number | null
  reason: string
}

export type SessionAction =
  | { type: 'configure'; exercise?: ExerciseId; side?: Side; plan?: Partial<SessionPlan> }
  | { type: 'start'; now: number }
  | { type: 'aligned'; now: number }
  | { type: 'rep'; rep: RepRecord; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'skipRest'; now: number }
  | { type: 'endSet'; now: number }
  | { type: 'applyAdjustment'; adjustment: PlanAdjustment; now: number }
  | { type: 'reset' }

export const DEFAULT_PLAN = { sets: 3, reps: 8, restSeconds: 45 }

export function defaultPlan(exercise: ExerciseId): SessionPlan {
  return { ...DEFAULT_PLAN, targetDeg: EXERCISES[exercise].targetDeg }
}

export function createInitialState(exercise: ExerciseId, side: Side, plan?: Partial<SessionPlan>): SessionState {
  return {
    exercise,
    side,
    plan: { ...defaultPlan(exercise), ...plan },
    phase: 'idle',
    paused: false,
    currentSet: 1,
    completedSets: [],
    currentReps: [],
    setStartedAt: null,
    sessionStartedAt: null,
    restRemainingMs: 0,
    restLastTickAt: null,
    nudge: null,
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function finishSet(state: SessionState, now: number, endedEarly: boolean, nudge: Nudge | null): SessionState {
  const set: SetRecord = {
    setNumber: state.currentSet,
    reps: state.currentReps,
    fatigue: estimateFatigue(state.currentReps),
    startedAt: state.setStartedAt ?? now,
    endedAt: now,
    endedEarly,
  }
  const completedSets = [...state.completedSets, set]
  if (state.currentSet >= state.plan.sets) {
    return { ...state, completedSets, currentReps: [], setStartedAt: null, phase: 'complete', paused: false, nudge }
  }
  return {
    ...state,
    completedSets,
    currentReps: [],
    setStartedAt: null,
    phase: 'rest',
    restRemainingMs: state.plan.restSeconds * 1000,
    restLastTickAt: now,
    nudge,
  }
}

function nextSet(state: SessionState): SessionState {
  return {
    ...state,
    phase: 'align',
    currentSet: state.currentSet + 1,
    currentReps: [],
    setStartedAt: null,
    restRemainingMs: 0,
    restLastTickAt: null,
  }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'configure': {
      if (state.phase !== 'idle') return state
      const exercise = action.exercise ?? state.exercise
      const basePlan = action.exercise && action.exercise !== state.exercise ? defaultPlan(exercise) : state.plan
      return { ...state, exercise, side: action.side ?? state.side, plan: { ...basePlan, ...action.plan } }
    }
    case 'start':
      if (state.phase !== 'idle') return state
      return {
        ...state,
        phase: 'align',
        sessionStartedAt: action.now,
        currentSet: 1,
        completedSets: [],
        currentReps: [],
        nudge: null,
      }
    case 'aligned':
      if (state.phase !== 'align' || state.paused) return state
      return { ...state, phase: 'active', setStartedAt: action.now, nudge: null }
    case 'rep': {
      if (state.phase !== 'active' || state.paused) return state
      const rep = { ...action.rep, index: state.currentReps.length + 1 }
      const currentReps = [...state.currentReps, rep]
      const next = { ...state, currentReps }
      if (currentReps.length >= state.plan.reps) return finishSet(next, action.now, false, null)
      if (currentReps.length >= FATIGUE_MIN_REPS) {
        const f = estimateFatigue(currentReps)
        if (f.index >= FATIGUE_STOP) {
          return finishSet(next, action.now, true, {
            text: `Range dropped ${f.romDropDeg.toFixed(0)}° over this set. Resting early.`,
            at: action.now,
          })
        }
        if (f.index >= FATIGUE_NUDGE) {
          return {
            ...next,
            nudge: { text: 'Your last reps are getting shorter. Slow down and reach full range.', at: action.now },
          }
        }
      }
      return next
    }
    case 'pause':
      if (state.phase !== 'active' && state.phase !== 'rest' && state.phase !== 'align') return state
      return { ...state, paused: true }
    case 'resume':
      if (!state.paused) return state
      return { ...state, paused: false, restLastTickAt: state.phase === 'rest' ? action.now : state.restLastTickAt }
    case 'tick': {
      if (state.phase !== 'rest' || state.paused) return state
      const last = state.restLastTickAt ?? action.now
      const remaining = state.restRemainingMs - (action.now - last)
      if (remaining <= 0) return nextSet(state)
      return { ...state, restRemainingMs: remaining, restLastTickAt: action.now }
    }
    case 'skipRest':
      if (state.phase !== 'rest') return state
      return { ...nextSet(state), paused: false }
    case 'endSet':
      if (state.phase !== 'active') return state
      return finishSet({ ...state, paused: false }, action.now, state.currentReps.length < state.plan.reps, null)
    case 'applyAdjustment': {
      const a = action.adjustment
      const plan: SessionPlan = {
        sets: a.sets != null ? clamp(Math.round(a.sets), state.currentSet, 10) : state.plan.sets,
        reps: a.reps != null ? clamp(Math.round(a.reps), 1, 50) : state.plan.reps,
        restSeconds: a.restSeconds != null ? clamp(Math.round(a.restSeconds), 10, 600) : state.plan.restSeconds,
        targetDeg: a.targetDeg != null ? clamp(a.targetDeg, 0, 180) : state.plan.targetDeg,
      }
      return { ...state, plan, nudge: { text: a.reason, at: action.now } }
    }
    case 'reset':
      return createInitialState(state.exercise, state.side, state.plan)
  }
}

export function summarizeSets(sets: readonly SetRecord[]): SessionSummary {
  const reps = sets.flatMap((s) => s.reps)
  const peaks = reps.map((r) => r.peakDeg)
  const fatigue = sets.filter((s) => s.fatigue.sampleReps >= FATIGUE_MIN_REPS).map((s) => s.fatigue.index)
  return {
    totalReps: reps.length,
    bestPeakDeg: peaks.length ? Math.max(...peaks) : 0,
    meanPeakDeg: peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : 0,
    fatigueIndex: fatigue.length ? fatigue.reduce((a, b) => a + b, 0) / fatigue.length : 0,
  }
}

/** Seconds left in the rest countdown, for display. */
export function restSecondsLeft(state: SessionState): number {
  return Math.max(0, Math.ceil(state.restRemainingMs / 1000))
}
