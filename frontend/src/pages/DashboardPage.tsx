import { EXERCISE_LIST, EXERCISES, type ExerciseId, type PlanDto, type ProgressDto, type SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { StreamStatus } from '../api/sse'
import { IconActivity, IconCalendar, IconCamera, IconFlame, IconTarget, IconUsers } from '../components/icons'
import { AnimatedNumber, Item, Page, Stagger } from '../components/motion'
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
  const [live, setLive] = useState<StreamStatus>('closed')
  const [arrived, setArrived] = useState<SessionDto | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Live feed: the API pushes each session the camera app stores; reload the numbers when one lands.
  useEffect(() => {
    if (!selectedId) return
    setArrived(null)
    return api.sessions.stream(selectedId, {
      onStatus: setLive,
      onEvent: (event, data) => {
        if (event !== 'session') return
        setArrived(data as SessionDto)
        setRefreshKey((k) => k + 1)
      },
    })
  }, [selectedId])

  useEffect(() => {
    if (!arrived) return
    const id = setTimeout(() => setArrived(null), 8_000)
    return () => clearTimeout(id)
  }, [arrived])

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
  }, [selectedId, exercise, refreshKey])

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
      <Page>
        <PageHeader eyebrow="Welcome" title="Let's set up the first profile" subtitle="A profile is one person who exercises. Everyone in the household gets their own." />
        {error && (
          <div className="mb-4">
            <Alert tone="bad">{error}</Alert>
          </div>
        )}
        <EmptyState
          icon={<IconUsers size={44} strokeWidth={1.5} />}
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
      </Page>
    )
  }

  const exerciseName = EXERCISES[exercise].name
  const latest = progress?.sessions.at(-1) ?? null
  const goal = progress?.targetDeg ?? null
  const bestAll = progress && progress.sessions.length ? Math.max(...progress.sessions.map((s) => s.bestPeakDeg)) : 0
  const thisWeek = progress?.sessionsPerWeek.find((w) => w.weekStart === weekStartIso(Date.now()))?.count ?? 0
  const fatigue = latest ? fatigueLabel(latest.fatigueIndex) : null

  return (
    <Page>
      <PageHeader
        eyebrow="Dashboard"
        title={selected?.name ?? 'Dashboard'}
        subtitle={
          <>
            {exerciseName}. Progress from the sessions the camera app recorded.{' '}
            <span className={`badge ml-1 align-middle ${live === 'open' ? 'bg-good-soft text-good' : ''}`} title={live === 'open' ? 'New sessions appear here the moment they are stored' : 'Live feed reconnecting'}>
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${live === 'open' ? 'bg-good' : 'bg-muted'}`} /> {live === 'open' ? 'Live' : 'Offline'}
            </span>
          </>
        }
        actions={<Segmented label="Exercise" options={EXERCISE_OPTIONS} value={exercise} onChange={setExercise} />}
      />

      {arrived && (
        <div className="mb-5">
          <Alert tone="good">
            New session just landed: {EXERCISES[arrived.exercise].name}, {arrived.summary.totalReps} reps, best {deg(arrived.summary.bestPeakDeg)}.{' '}
            <Link to={`/sessions/${arrived.id}`}>Open it</Link>
          </Alert>
        </div>
      )}

      {error && (
        <div className="mb-5">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}

      {loading && !progress && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={128} />
          ))}
        </div>
      )}

      {progress && progress.sessions.length === 0 && (
        <div className="mb-5">
          <EmptyState
            icon={<IconCamera size={44} strokeWidth={1.5} />}
            title={`No ${exerciseName.toLowerCase()} sessions for ${selected?.name ?? 'this profile'} yet`}
            description={
              <>
                Sessions arrive from the camera app. Open it, choose <strong>{selected?.name}</strong>, do a set of {exerciseName.toLowerCase()}, and the result shows up here within
                seconds. Try another exercise above, or load demo data to preview the charts.
              </>
            }
            action={
              <button className="btn btn-primary" onClick={seedDemo} disabled={seeding}>
                {seeding ? 'Loading…' : 'Load demo data'}
              </button>
            }
          />
        </div>
      )}

      {progress && latest && fatigue && (
        <>
          <Stagger className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Item>
              <StatTile
                label="Best range"
                icon={<IconTarget size={18} />}
                value={<AnimatedNumber value={bestAll} suffix="°" />}
                hint={goal == null ? 'no goal set' : bestAll >= goal ? `goal of ${deg(goal)} reached` : `${deg(goal - bestAll)} short of the ${deg(goal)} goal`}
                tone={goal != null && bestAll >= goal ? 'good' : 'primary'}
              />
            </Item>
            <Item>
              <StatTile label="Latest session" icon={<IconActivity size={18} />} value={<AnimatedNumber value={latest.bestPeakDeg} suffix="°" />} hint={`${formatDate(latest.date)} · ${latest.totalReps} reps`} tone="primary" />
            </Item>
            <Item>
              <StatTile label="Sessions this week" icon={<IconCalendar size={18} />} value={<AnimatedNumber value={thisWeek} />} hint={`${progress.sessions.length} total for ${exerciseName.toLowerCase()}`} tone={thisWeek >= 3 ? 'good' : 'default'} />
            </Item>
            <Item>
              <StatTile label="Fatigue proxy" icon={<IconFlame size={18} />} value={<AnimatedNumber value={latest.fatigueIndex} decimals={2} />} hint={fatigue.text} tone={fatigue.tone} />
            </Item>
          </Stagger>
          <ProgressCharts progress={progress} metricLabel={EXERCISES[exercise].metricLabel} />
        </>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card title="Recent sessions" subtitle="All exercises, newest first. Open one for the set-by-set view.">
          {sessions.length === 0 ? (
            <p className="text-[14px] text-muted">None yet.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
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
                        <Link className="font-bold" to={`/sessions/${s.id}`}>
                          {formatDateTime(s.startedAt)}
                        </Link>
                        {s.demo && <span className="badge">demo</span>}
                      </td>
                      <td className="font-semibold">
                        {EXERCISES[s.exercise].name} <span className="text-[12px] font-medium text-muted">· {s.side}</span>
                      </td>
                      <td className="num">{s.summary.totalReps}</td>
                      <td className="num font-bold">{deg(s.summary.bestPeakDeg)}</td>
                      <td className="num">{deg(s.summary.meanPeakDeg)}</td>
                      <td className="num">{s.summary.fatigueIndex.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {selectedId && <PlanEditor profileId={selectedId} plan={plan} onSaved={setPlan} />}
      </div>
    </Page>
  )
}
