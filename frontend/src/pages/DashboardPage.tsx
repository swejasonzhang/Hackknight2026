import { EXERCISE_LIST, EXERCISES, type ExerciseId, type PlanDto, type ProgressDto, type SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { IconCamera, IconUsers } from '../components/icons'
import { PlanEditor } from '../components/PlanEditor'
import { ProgressCharts } from '../components/ProgressCharts'
import { Alert, Card, EmptyState, PageHeader, Segmented, Skeleton, StatTile } from '../components/ui'
import { deg, fatigueLabel, formatDate, formatDateTime, weekStartIso } from '../format'
import { useProfiles } from '../hooks/useProfiles'

const EXERCISE_OPTIONS = EXERCISE_LIST.map((e) => ({ value: e.id, label: e.name }))

export function DashboardPage() {
  const { profiles, selected, selectedId, setSelectedId, reload, loading: profilesLoading } = useProfiles()
  const [exercise, setExercise] = useState<ExerciseId>('elbow_flexion')
  const [progress, setProgress] = useState<ProgressDto | null>(null)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sessions, setSessions] = useState<SessionDto[]>([])
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([api.progress(selectedId, exercise), api.plan.get(selectedId).catch(() => null), api.sessions.list(selectedId)])
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
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, exercise])

  const seedDemo = async () => {
    setSeeding(true)
    setError(null)
    try {
      const r = await api.dev.seed()
      await reload()
      setSelectedId(r.profileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load demo data')
    } finally {
      setSeeding(false)
    }
  }

  if (!profilesLoading && profiles.length === 0) {
    return (
      <div className="page">
        <PageHeader eyebrow="Welcome" title="Let's set up the first profile" subtitle="A profile is one person who exercises. Everyone in the household gets their own." />
        {error && <Alert tone="bad">{error}</Alert>}
        <EmptyState
          icon={<IconUsers />}
          title="No profiles yet"
          description="Add yourself or a family member, or load the demo profile to see what six weeks of progress looks like."
          action={
            <>
              <Link className="btn btn-primary" to="/profiles">
                Add a profile
              </Link>
              <button className="btn" onClick={seedDemo} disabled={seeding}>
                {seeding ? 'Loading…' : 'Load demo data'}
              </button>
            </>
          }
        />
      </div>
    )
  }

  const exerciseName = EXERCISES[exercise].name
  const latest = progress?.sessions.at(-1) ?? null
  const goal = progress?.targetDeg ?? null
  const bestAll = progress && progress.sessions.length ? Math.max(...progress.sessions.map((s) => s.bestPeakDeg)) : 0
  const thisWeek = progress?.sessionsPerWeek.find((w) => w.weekStart === weekStartIso(Date.now()))?.count ?? 0
  const fatigue = latest ? fatigueLabel(latest.fatigueIndex) : null

  return (
    <div className="page">
      <PageHeader
        eyebrow="Dashboard"
        title={selected?.name ?? 'Dashboard'}
        subtitle={`${exerciseName}. Progress from the sessions the camera app recorded.`}
        actions={<Segmented label="Exercise" options={EXERCISE_OPTIONS} value={exercise} onChange={setExercise} />}
      />

      {error && <Alert tone="bad">{error}</Alert>}

      {loading && !progress && (
        <div className="stat-grid">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={96} />
          ))}
        </div>
      )}

      {progress && progress.sessions.length === 0 && (
        <div style={{ marginBottom: 18 }}>
          <EmptyState
            icon={<IconCamera />}
            title={`No ${exerciseName.toLowerCase()} sessions for ${selected?.name ?? 'this profile'} yet`}
            description={
              <>
                Sessions arrive from the camera app. Open it, choose <strong>{selected?.name}</strong>, do a set of {exerciseName.toLowerCase()}, and the result shows up here within
                seconds. Try another exercise above, or load demo data to preview the charts.
              </>
            }
            action={
              <button className="btn" onClick={seedDemo} disabled={seeding}>
                {seeding ? 'Loading…' : 'Load demo data'}
              </button>
            }
          />
        </div>
      )}

      {progress && latest && fatigue && (
        <>
          <div className="stat-grid">
            <StatTile
              label="Best range"
              value={deg(bestAll)}
              hint={goal == null ? 'no goal set' : bestAll >= goal ? `goal of ${deg(goal)} reached` : `${deg(goal - bestAll)} short of the ${deg(goal)} goal`}
              tone={goal != null && bestAll >= goal ? 'good' : 'primary'}
            />
            <StatTile label="Latest session" value={deg(latest.bestPeakDeg)} hint={`${formatDate(latest.date)} · ${latest.totalReps} reps`} />
            <StatTile label="Sessions this week" value={thisWeek} hint={`${progress.sessions.length} total for ${exerciseName.toLowerCase()}`} tone={thisWeek >= 3 ? 'good' : 'default'} />
            <StatTile label="Fatigue proxy" value={latest.fatigueIndex.toFixed(2)} hint={fatigue.text} tone={fatigue.tone} />
          </div>
          <ProgressCharts progress={progress} metricLabel={EXERCISES[exercise].metricLabel} />
        </>
      )}

      <div className="layout">
        <section className="main">
          <Card title="Recent sessions" subtitle="All exercises, newest first. Open one for the set-by-set view.">
            {sessions.length === 0 ? (
              <p className="muted">None yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Exercise</th>
                      <th className="num">Reps</th>
                      <th className="num">Best</th>
                      <th className="num">Mean</th>
                      <th className="num">Fatigue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 12).map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/sessions/${s.id}`}>{formatDateTime(s.startedAt)}</Link>
                          {s.demo && <span className="badge">demo</span>}
                        </td>
                        <td>
                          {EXERCISES[s.exercise].name} <span className="muted small">· {s.side}</span>
                        </td>
                        <td className="num">{s.summary.totalReps}</td>
                        <td className="num">{deg(s.summary.bestPeakDeg)}</td>
                        <td className="num">{deg(s.summary.meanPeakDeg)}</td>
                        <td className="num">{s.summary.fatigueIndex.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
        <aside className="side">{selectedId && <PlanEditor profileId={selectedId} plan={plan} onSaved={setPlan} />}</aside>
      </div>
    </div>
  )
}
