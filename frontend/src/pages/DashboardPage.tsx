import { EXERCISE_LIST, EXERCISES, type ExerciseId, type PlanDto, type ProgressDto, type SessionDto } from '@ptg/dependencies'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ProfilePicker } from '../components/ProfilePicker'
import { PlanEditor } from '../components/PlanEditor'
import { ProgressCharts } from '../components/ProgressCharts'
import { deg, formatDateTime } from '../format'
import { useProfiles } from '../hooks/useProfiles'

export function DashboardPage() {
  const { profiles, selectedId, setSelectedId, loading } = useProfiles()
  const [exercise, setExercise] = useState<ExerciseId>('elbow_flexion')
  const [progress, setProgress] = useState<ProgressDto | null>(null)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sessions, setSessions] = useState<SessionDto[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setError(null)
    Promise.all([
      api.progress(selectedId, exercise),
      api.plan.get(selectedId).catch(() => null),
      api.sessions.list(selectedId),
    ])
      .then(([p, pl, s]) => {
        if (cancelled) return
        setProgress(p)
        setPlan(pl)
        setSessions(s)
        // Follow the plan's exercise the first time a profile is picked.
        if (pl && p.sessions.length === 0 && pl.exercise !== exercise) setExercise(pl.exercise)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load progress')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, exercise])

  return (
    <div className="page">
      <header className="page-header">
        <h2>Dashboard</h2>
        <ProfilePicker profiles={profiles} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
        <label className="inline">
          Exercise
          <select value={exercise} onChange={(e) => setExercise(e.target.value as ExerciseId)}>
            {EXERCISE_LIST.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="error">{error}</p>}
      {progress && <ProgressCharts progress={progress} metricLabel={EXERCISES[exercise].metricLabel} />}

      <div className="layout">
        <section className="main">
          <div className="card">
            <h3>Recent sessions</h3>
            {sessions.length === 0 ? (
              <p className="muted">None yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Exercise</th>
                    <th>Reps</th>
                    <th>Best</th>
                    <th>Mean</th>
                    <th>Fatigue</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 12).map((s) => (
                    <tr key={s.id}>
                      <td>
                        {formatDateTime(s.startedAt)} {s.demo && <span className="badge">demo</span>}
                      </td>
                      <td>{EXERCISES[s.exercise].name}</td>
                      <td>{s.summary.totalReps}</td>
                      <td>{deg(s.summary.bestPeakDeg)}</td>
                      <td>{deg(s.summary.meanPeakDeg)}</td>
                      <td>{s.summary.fatigueIndex.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        <aside className="side">{selectedId && <PlanEditor profileId={selectedId} plan={plan} onSaved={setPlan} />}</aside>
      </div>
    </div>
  )
}
