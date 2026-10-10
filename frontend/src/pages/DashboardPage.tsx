import { EXERCISE_LIST, EXERCISES, type ExerciseId, type PlanDto, type ProgressDto, type SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { IconActivity, IconCalendar, IconFlame, IconTarget } from '../components/icons'
import { AnimatedNumber, Page } from '../components/motion'
import { PlanEditor } from '../components/PlanEditor'
import { ProfilePicker } from '../components/ProfilePicker'
import { ProgressCharts } from '../components/ProgressCharts'
import { LazyJointScene, LazyProgressScene } from '../components/three/lazy'
import { Alert, EmptyState, Lamp, Segmented, Skeleton, StatTile, Strip, Tag } from '../components/ui'
import { deg, fatigueLabel, formatDate, formatDateTime, weekStartIso } from '../format'
import { useProfiles } from '../hooks/useProfiles'

/** The switch carries short labels; the full exercise name is printed on the stage beneath it. */
const SHORT: Record<ExerciseId, string> = { elbow_flexion: 'Elbow', shoulder_abduction: 'Shoulder', seated_knee_extension: 'Knee' }
const EXERCISE_OPTIONS = EXERCISE_LIST.map((e) => ({ value: e.id, label: SHORT[e.id] }))

function useIsPhone(): boolean {
  const query = '(max-width: 639px)'
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const update = () => setPhone(m.matches)
    m.addEventListener?.('change', update)
    return () => m.removeEventListener?.('change', update)
  }, [])
  return phone
}

/**
 * The dashboard as an instrument: a sticky measurement panel (who, which movement, the 3D
 * specimen posed at the latest best rep, a ledger of readings, the plan in one line) beside a
 * single scrolling column of numbered, ruled strips (charts, the 3D trend, the log, the plan).
 */
export function DashboardPage() {
  const { profiles, selected, selectedId, setSelectedId, reload, loading: profilesLoading } = useProfiles()
  const [exercise, setExercise] = useState<ExerciseId>('elbow_flexion')
  const [progress, setProgress] = useState<ProgressDto | null>(null)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sessions, setSessions] = useState<SessionDto[]>([])
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open3d, setOpen3d] = useState(false)
  const phone = useIsPhone()

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

  const noProfiles = !profilesLoading && profiles.length === 0
  const cfg = EXERCISES[exercise]
  const data = noProfiles ? null : progress
  const latest = data?.sessions.at(-1) ?? null
  const first = data?.sessions[0] ?? null
  const goal = data?.targetDeg ?? (plan && plan.exercise === exercise ? plan.targetDeg : null)
  const bestAll = data && data.sessions.length ? Math.max(...data.sessions.map((s) => s.bestPeakDeg)) : null
  const thisWeek = data?.sessionsPerWeek.find((w) => w.weekStart === weekStartIso(Date.now()))?.count ?? 0
  const fatigue = latest ? fatigueLabel(latest.fatigueIndex) : null
  const noSignal = !noProfiles && data != null && data.sessions.length === 0
  const firstLoad = (profilesLoading || loading) && !data

  const none = <span className="text-lamp-off">–</span>

  const demoButton = (primary: boolean) => (
    <button type="button" className={`btn ${primary ? 'btn-block' : ''}`} onClick={seedDemo} disabled={seeding}>
      {seeding ? 'Loading…' : 'Load demo data'}
    </button>
  )

  return (
    <Page className="grid gap-8 lg:grid-cols-12 lg:gap-8">
      {/* ---------- Measurement panel ---------- */}
      <section aria-label="Measurement panel" className="panel self-start p-4 sm:p-5 lg:sticky lg:top-8 lg:col-span-5 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-4">
          <ProfilePicker />
          <Link to="/profiles" className="btn btn-ghost flex-none">
            Manage →
          </Link>
        </div>

        <div className="mt-4">
          <Segmented label="Exercise" options={EXERCISE_OPTIONS} value={exercise} onChange={setExercise} />
        </div>

        <div className="stage mt-4 h-[260px] overflow-hidden sm:h-[320px]">
          {latest ? (
            <LazyJointScene exercise={exercise} angle={latest.bestPeakDeg} goalDeg={goal ?? undefined} className="h-full w-full" label={`${cfg.name} posed at the latest session's best rep, ${deg(latest.bestPeakDeg)}`} fallback={<div className="hatch absolute inset-8" aria-hidden="true" />} />
          ) : firstLoad ? (
            <div className="hatch absolute inset-8" aria-hidden="true" />
          ) : (
            <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <span className="callout relative flex items-center gap-2">
                <Lamp /> {noProfiles ? 'No profile' : 'No signal'}
              </span>
            </div>
          )}
          <span className="callout top-3 left-3" aria-hidden="true">
            {cfg.name}
            {latest ? ` · ${formatDate(latest.date)}` : ''}
          </span>
          {goal != null && (
            <span className="callout top-3 right-3" aria-hidden="true">
              Goal {goal}°
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-4 border-b border-rule pt-4 pb-4">
          {latest ? (
            <div className="t-readout">
              <AnimatedNumber value={latest.bestPeakDeg} suffix="°" />
            </div>
          ) : (
            <div className="t-label flex items-center gap-2 pb-2 text-muted">
              <span aria-hidden="true" className="lamp" /> No reading yet
            </div>
          )}
          <div className="t-meta pb-2 text-right">
            Latest session
            <br />
            best rep
          </div>
        </div>

        <div>
          <StatTile
            label="Best range"
            icon={<IconTarget />}
            value={bestAll != null ? <AnimatedNumber value={bestAll} suffix="°" /> : none}
            hint={bestAll == null ? 'no sessions yet' : goal == null ? 'no goal set' : bestAll >= goal ? `goal of ${deg(goal)} reached` : `${deg(goal - bestAll)} short of the ${deg(goal)} goal`}
            tone={bestAll == null ? 'default' : goal != null && bestAll >= goal ? 'good' : 'primary'}
          />
          <StatTile label="Latest session" icon={<IconActivity />} value={latest ? <AnimatedNumber value={latest.bestPeakDeg} suffix="°" /> : none} hint={latest ? `${formatDate(latest.date)} · ${latest.totalReps} reps` : 'waiting for the camera app'} tone={latest ? 'primary' : 'default'} />
          <StatTile label="Sessions this week" icon={<IconCalendar />} value={data ? <AnimatedNumber value={thisWeek} /> : none} hint={data ? `${data.sessions.length} total for ${cfg.name.toLowerCase()}` : 'no sessions yet'} tone={thisWeek >= 3 ? 'good' : 'default'} />
          <StatTile label="Fatigue proxy" icon={<IconFlame />} value={latest ? <AnimatedNumber value={latest.fatigueIndex} decimals={2} /> : none} hint={fatigue ? fatigue.text : 'needs four reps in a set'} tone={fatigue ? fatigue.tone : 'default'} />
        </div>

        {plan && (
          <a href="#plan" className="t-meta mt-4 flex items-center justify-between gap-3 text-ink-2 hover:no-underline">
            <span>
              Plan {plan.sets} × {plan.reps} · {plan.restSeconds} s · {plan.targetDeg}°
            </span>
            <span className="text-cobalt">Edit ↓</span>
          </a>
        )}
      </section>

      {/* ---------- Readout column ---------- */}
      <div className="min-w-0 lg:col-span-7">
        <header className="mb-6">
          <div className="t-meta mb-3">Dashboard · readout</div>
          <h1 className="t-title">{noProfiles ? 'First profile' : (selected?.name ?? 'Dashboard')}</h1>
          <p className="t-meta mt-3 text-ink-2">
            {cfg.name}
            {data ? ` · ${data.sessions.length} sessions` : ''}
            {first ? ` · since ${formatDate(first.date)}` : ''}
          </p>
        </header>

        {error && (
          <div className="mb-6">
            <Alert tone="bad">{error}</Alert>
          </div>
        )}

        {noProfiles && (
          <Strip index="00" title="Setup">
            <EmptyState
              title="No profiles yet"
              description="A profile is one person who exercises; everyone in the household gets their own. Add one, or load the demo profile to see six weeks of readouts."
              action={
                <>
                  <Link className="btn btn-block" to="/profiles">
                    Add a profile
                  </Link>
                  {demoButton(false)}
                </>
              }
            />
          </Strip>
        )}

        {noSignal && (
          <Strip index="00" title="Waiting for a session">
            <EmptyState
              title={`No signal for ${cfg.name.toLowerCase()}`}
              description={
                <>
                  Sessions arrive from the camera app. Open it, choose <strong>{selected?.name}</strong>, do a set of {cfg.name.toLowerCase()}, and the readout lands here within seconds. Switch movement in the panel, or load the demo data.
                </>
              }
              action={demoButton(true)}
            />
          </Strip>
        )}

        {firstLoad && !noProfiles && (
          <div className="flex flex-col gap-6" aria-hidden="true">
            <Skeleton height={280} />
            <Skeleton height={220} />
          </div>
        )}

        {data && data.sessions.length > 0 && (
          <>
            <ProgressCharts progress={data} metricLabel={cfg.metricLabel} />
            <Strip index="05" title="Peak per session, in 3D" aside="Drag to orbit · lighter is higher">
              {phone ? (
                <details onToggle={(e) => setOpen3d((e.currentTarget as HTMLDetailsElement).open)} className="border-t border-rule">
                  <summary className="t-meta flex cursor-pointer list-none items-center gap-3 py-3 text-ink-2 [&::-webkit-details-marker]:hidden">
                    <span className="font-mono text-[14px] leading-none text-navy" aria-hidden="true">
                      {open3d ? '−' : '+'}
                    </span>
                    Open the 3D view
                  </summary>
                  {open3d && (
                    <div className="stage h-[240px]">
                      <LazyProgressScene points={data.sessions.map((s) => ({ label: formatDate(s.date), value: s.bestPeakDeg, sub: `${s.totalReps} reps` }))} goal={goal} className="h-full" label={`Best ${cfg.name.toLowerCase()} per session as 3D bars`} fallback={<div className="hatch h-full" />} />
                    </div>
                  )}
                </details>
              ) : (
                <div className="stage h-[300px]">
                  <LazyProgressScene
                    points={data.sessions.map((s) => ({ label: formatDate(s.date), value: s.bestPeakDeg, sub: `${s.totalReps} reps` }))}
                    goal={goal}
                    className="h-full"
                    label={`Best ${cfg.name.toLowerCase()} per session as 3D bars${goal != null ? ` against a ${goal} degree goal` : ''}`}
                    fallback={<div className="hatch h-full" />}
                  />
                </div>
              )}
            </Strip>
          </>
        )}

        {!noProfiles && (
          <Strip index="06" title="Log" aside="All movements · newest first">
            {sessions.length === 0 ? (
              <p className="t-mono">No sessions yet.</p>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Movement</th>
                      <th scope="col" className="num">
                        Reps
                      </th>
                      <th scope="col" className="num">
                        Best
                      </th>
                      <th scope="col" className="num hidden sm:table-cell">
                        Mean
                      </th>
                      <th scope="col" className="num hidden sm:table-cell">
                        Fatigue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 12).map((s) => (
                      <tr key={s.id}>
                        <td className="whitespace-nowrap">
                          <Link className="font-mono text-[12.5px]" to={`/sessions/${s.id}`}>
                            {formatDateTime(s.startedAt)}
                          </Link>
                          {s.demo && <Tag soft className="ml-2">Demo</Tag>}
                        </td>
                        <td>
                          <span className="font-medium text-ink">{EXERCISES[s.exercise].name}</span> <span className="t-meta">· {s.side}</span>
                        </td>
                        <td className="num">{s.summary.totalReps}</td>
                        <td className="num font-medium text-navy">{deg(s.summary.bestPeakDeg)}</td>
                        <td className="num hidden sm:table-cell">{deg(s.summary.meanPeakDeg)}</td>
                        <td className="num hidden sm:table-cell">{s.summary.fatigueIndex.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Strip>
        )}

        {!noProfiles && selectedId && (
          <Strip index="07" title="Plan" aside="Read by the camera app" id="plan">
            <PlanEditor profileId={selectedId} plan={plan} onSaved={setPlan} />
          </Strip>
        )}
      </div>
    </Page>
  )
}
