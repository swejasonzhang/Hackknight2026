import {
  createInitialState,
  EXERCISE_LIST,
  EXERCISES,
  restSecondsLeft,
  sessionReducer,
  type ExerciseId,
  type PlanDto,
  type RepRecord,
  type SessionDto,
  type Side,
} from '@ptg/dependencies'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { ProfilePicker } from '../components/ProfilePicker'
import { RepList } from '../components/RepList'
import { SessionControls } from '../components/SessionControls'
import { DEFAULT_SIMULATOR, SimulatorPanel, type SimulatorSettings } from '../components/SimulatorPanel'
import { deg } from '../format'
import { useMotionReps } from '../hooks/useMotionReps'
import { useProfiles } from '../hooks/useProfiles'
import { SimulatedMotionSource } from '../motion/SimulatedMotionSource'
import type { MotionSource } from '../motion/types'

const ALIGN_HOLD_MS = 1500

export function SessionPage() {
  const { profiles, selectedId, setSelectedId, loading: profilesLoading } = useProfiles()
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => createInitialState('elbow_flexion', 'right'))
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sim, setSim] = useState<SimulatorSettings>(DEFAULT_SIMULATOR)
  const [saved, setSaved] = useState<SessionDto | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const exercise = EXERCISES[state.exercise]

  // Load the profile's active plan and configure the session from it.
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    api.plan
      .get(selectedId)
      .then((p) => {
        if (cancelled) return
        setPlan(p)
        dispatch({ type: 'configure', exercise: p.exercise, side: p.side, plan: { sets: p.sets, reps: p.reps, restSeconds: p.restSeconds, targetDeg: p.targetDeg } })
      })
      .catch(() => {
        if (!cancelled) setPlan(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // The motion source: a simulated user until the CV module provides CameraMotionSource.
  const source = useMemo<MotionSource>(
    () =>
      new SimulatedMotionSource({
        periodMs: sim.periodMs,
        restDeg: exercise.exitDeg - 25,
        peakDeg: state.plan.targetDeg + sim.peakOffsetDeg,
        peakDecayPerRep: sim.peakDecayPerRep,
        slowdownPerRep: sim.slowdownPerRep,
      }),
    // A new set re-creates the source so simulator changes apply at set boundaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise, state.plan.targetDeg, state.currentSet, state.phase === 'idle'],
  )

  const onRep = useCallback((rep: RepRecord) => dispatch({ type: 'rep', rep, now: Date.now() }), [])
  const live = useMotionReps(source, exercise, {
    counting: state.phase === 'active' && !state.paused,
    resetKey: state.currentSet,
    onRep,
  })

  // Alignment check: hold a tracked joint for a moment before the set starts.
  const alignedSince = useRef<number | null>(null)
  useEffect(() => {
    if (state.phase !== 'align' || state.paused || !live.tracked) {
      alignedSince.current = null
      return
    }
    alignedSince.current ??= Date.now()
    const remaining = ALIGN_HOLD_MS - (Date.now() - alignedSince.current)
    const id = setTimeout(() => dispatch({ type: 'aligned', now: Date.now() }), Math.max(0, remaining))
    return () => clearTimeout(id)
  }, [state.phase, state.paused, live.tracked])

  // Rest countdown.
  useEffect(() => {
    if (state.phase !== 'rest' || state.paused) return
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 250)
    return () => clearInterval(id)
  }, [state.phase, state.paused])

  // Save once when the session completes.
  useEffect(() => {
    if (state.phase !== 'complete' || saved || !selectedId) return
    const endedAt = Date.now()
    api.sessions
      .create({
        profileId: selectedId,
        exercise: state.exercise,
        side: state.side,
        startedAt: state.sessionStartedAt ?? endedAt,
        endedAt,
        plan: state.plan,
        sets: state.completedSets,
      })
      .then(setSaved)
      .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : 'Could not save the session'))
  }, [state.phase, state.exercise, state.side, state.sessionStartedAt, state.plan, state.completedSets, saved, selectedId])

  const reset = () => {
    setSaved(null)
    setSaveError(null)
    dispatch({ type: 'reset' })
  }

  const now = () => Date.now()
  const idle = state.phase === 'idle'

  return (
    <div className="page">
      <header className="page-header">
        <h2>Session</h2>
        <ProfilePicker profiles={profiles} selectedId={selectedId} onSelect={setSelectedId} loading={profilesLoading} />
      </header>

      <div className="layout">
        <section className="main">
          <div className="card readout">
            <div className="readout-value" aria-live="polite">
              {live.tracked ? deg(live.metricDeg) : '—'}
            </div>
            <div className="readout-label">
              {exercise.metricLabel} · {state.side} · {live.tracked ? live.phase : 'move into frame'}
            </div>
            <p className="cue">{exercise.cue}</p>
            <div className={`phase phase-${state.phase}`}>
              {state.phase === 'idle' && 'Ready'}
              {state.phase === 'align' && (live.tracked ? 'Hold still… starting' : 'Get into position')}
              {state.phase === 'active' && (state.paused ? 'Paused' : 'Go')}
              {state.phase === 'rest' && (state.paused ? 'Rest paused' : 'Rest')}
              {state.phase === 'complete' && 'Session complete'}
            </div>
            {state.nudge && <div className="nudge">{state.nudge.text}</div>}
          </div>

          <SessionControls
            phase={state.phase}
            paused={state.paused}
            restSecondsLeft={restSecondsLeft(state)}
            onStart={() => dispatch({ type: 'start', now: now() })}
            onPause={() => dispatch({ type: 'pause', now: now() })}
            onResume={() => dispatch({ type: 'resume', now: now() })}
            onEndSet={() => dispatch({ type: 'endSet', now: now() })}
            onSkipRest={() => dispatch({ type: 'skipRest', now: now() })}
            onReset={reset}
          />

          {state.phase === 'complete' && (
            <div className="card">
              <h3>Saved</h3>
              {saved && (
                <p>
                  {saved.summary.totalReps} reps, best {deg(saved.summary.bestPeakDeg)}, mean {deg(saved.summary.meanPeakDeg)}.{' '}
                  <Link to="/dashboard">See the trend</Link>.
                </p>
              )}
              {!saved && !saveError && <p className="muted">Saving…</p>}
              {saveError && <p className="error">Not saved: {saveError}</p>}
            </div>
          )}

          <RepList metricLabel={exercise.metricLabel} plan={state.plan} currentSet={state.currentSet} currentReps={state.currentReps} completedSets={state.completedSets} />
        </section>

        <aside className="side">
          <div className="card">
            <h3>
              Plan {plan ? <span className="muted small">(saved for this profile)</span> : <span className="muted small">(default; save one on the Dashboard)</span>}
            </h3>
            <div className="grid-2">
              <label>
                Exercise
                <select disabled={!idle} value={state.exercise} onChange={(e) => dispatch({ type: 'configure', exercise: e.target.value as ExerciseId })}>
                  {EXERCISE_LIST.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Side
                <select disabled={!idle} value={state.side} onChange={(e) => dispatch({ type: 'configure', side: e.target.value as Side })}>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </label>
              <label>
                Sets
                <input type="number" min={1} max={10} disabled={!idle} value={state.plan.sets} onChange={(e) => dispatch({ type: 'configure', plan: { sets: Number(e.target.value) } })} />
              </label>
              <label>
                Reps
                <input type="number" min={1} max={50} disabled={!idle} value={state.plan.reps} onChange={(e) => dispatch({ type: 'configure', plan: { reps: Number(e.target.value) } })} />
              </label>
              <label>
                Rest (s)
                <input type="number" min={10} max={600} disabled={!idle} value={state.plan.restSeconds} onChange={(e) => dispatch({ type: 'configure', plan: { restSeconds: Number(e.target.value) } })} />
              </label>
              <label>
                Goal (°)
                <input type="number" min={0} max={180} disabled={!idle} value={state.plan.targetDeg} onChange={(e) => dispatch({ type: 'configure', plan: { targetDeg: Number(e.target.value) } })} />
              </label>
            </div>
          </div>
          <SimulatorPanel settings={sim} onChange={setSim} />
        </aside>
      </div>
    </div>
  )
}
