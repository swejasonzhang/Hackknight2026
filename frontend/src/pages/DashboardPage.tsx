import { EXERCISE_IDS, EXERCISES, prescriptionFor, type ExerciseId, type PlanDto, type ProgramDto, type ProgressDto } from '@arc/dependencies'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ExercisePicker } from '../components/ExercisePicker'
import { Folds, type FoldItem } from '../components/Folds'
import { RecordPanel } from '../components/RecordPanel'
import { IconActivity, IconCalendar, IconFlame, IconTarget } from '../components/icons'
import { AnimatedNumber, Item, Page, Stagger } from '../components/motion'
import { ProfilePicker } from '../components/ProfilePicker'
import { FatigueChart, PeakChart, RepChart, WeeklyChart } from '../components/ProgressCharts'
import { LazyJointScene, LazyProgressScene } from '../components/three/lazy'
import { restFor } from '../components/three/skeleton'
import { useRepLoop } from '../components/three/useRepLoop'
import { Alert, EmptyState, Lamp, Skeleton, StatTile, Strip } from '../components/ui'
import { deg, fatigueLabel, formatDate, weekStartIso } from '../format'
import { useStickyTop } from '../components/useStickyTop'
import { useProfiles } from '../hooks/useProfiles'
import { PlanCalendar } from '../plan/PlanCalendar'
import { MuscleKey } from '../components/MuscleKey'

const isExercise = (v: string | null): v is ExerciseId => EXERCISE_IDS.includes(v as ExerciseId)

/**
 * The dashboard as an instrument: a sticky measurement panel (who, which movement, the 3D
 * specimen posed at the latest best rep, a ledger of readings, the prescription in one line
 * linking to the plan page) beside the readout column, where every chart is folded behind a plus
 * with its latest reading on the row. The movement is picked from four body-area tabs and kept in
 * ?exercise=; everything follows it: the figure, the readings, the charts, Record and the calendar.
 */
export function DashboardPage() {
  const { profiles, selected, selectedId, setSelectedId, reload, loading: profilesLoading } = useProfiles()
  const [params, setParams] = useSearchParams()
  const picked = params.get('exercise')
  const pickedRef = useRef(picked)
  pickedRef.current = picked
  const exercise: ExerciseId = isExercise(picked) ? picked : 'elbow_flexion'
  const setExercise = (next: ExerciseId) =>
    setParams(
      (p) => {
        p.set('exercise', next)
        return p
      },
      { replace: true },
    )
  const [progress, setProgress] = useState<ProgressDto | null>(null)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [program, setProgram] = useState<ProgramDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panelRef, panelTop] = useStickyTop<HTMLElement>(32)

  // The plan and the week, once per profile; a freshly picked profile opens on its plan's movement.
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setPlan(null)
    setProgram(null)
    Promise.all([api.plan.get(selectedId).catch(() => null), api.plan.program(selectedId).catch(() => null)]).then(([pl, pr]) => {
      if (cancelled) return
      setPlan(pl)
      setProgram(pr)
      if (pl && !isExercise(pickedRef.current)) setExercise(pl.exercise)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // The readings for the movement picked.
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .progress(selectedId, exercise)
      .then((p) => {
        if (!cancelled) setProgress(p)
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
  const prescription = prescriptionFor(exercise, { plan, program, intake: selected?.intake })
  const goal = data?.targetDeg ?? (prescription.source === 'default' ? null : prescription.targetDeg)
  const bestAll = data && data.sessions.length ? Math.max(...data.sessions.map((s) => s.bestPeakDeg)) : null
  const thisWeek = data?.sessionsPerWeek.find((w) => w.weekStart === weekStartIso(Date.now()))?.count ?? 0
  const fatigue = latest ? fatigueLabel(latest.fatigueIndex) : null
  // The figure works through the whole range, rep after rep: from rest to the latest best and back.
  // Only this movement's own data drives it; while another movement's data is still on screen, it rests.
  const fresh = data && data.exercise === exercise ? data : null
  const freshBest = fresh?.sessions.at(-1)?.bestPeakDeg ?? null
  const loop = useRepLoop(exercise, freshBest)
  const noSignal = !noProfiles && data != null && data.sessions.length === 0
  const firstLoad = (profilesLoading || loading) && !data

  const none = <span className="text-lamp-off">–</span>

  const demoButton = (primary: boolean) => (
    <button type="button" className={`btn ${primary ? 'btn-block' : ''}`} onClick={seedDemo} disabled={seeding}>
      {seeding ? 'Loading…' : 'Load demo data'}
    </button>
  )

  return (
    <Page className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-8">
      {/* ---------- Measurement panel ---------- */}
      <section ref={panelRef} aria-label="Measurement panel" className="panel min-w-0 self-start p-4 sm:p-5 lg:sticky lg:col-span-5" style={{ top: panelTop }}>
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-4">
          <ProfilePicker />
          {!noProfiles && (
            <Link to="/profiles" className="btn btn-ghost flex-none">
              Manage →
            </Link>
          )}
        </div>

        <div className="mt-4">
          <ExercisePicker value={exercise} onChange={setExercise} />
        </div>

        <div className="stage mt-4 h-[300px] overflow-hidden sm:h-[340px]">
          {latest ? (
            // The figure starts below the two callouts, so a label never covers the head.
            <div className="absolute inset-x-0 top-11 bottom-0">
              <LazyJointScene
                exercise={exercise}
                angle={loop ?? restFor(exercise)}
                rangeDeg={freshBest ?? undefined}
                goalDeg={fresh ? (goal ?? undefined) : undefined}
                className="h-full w-full"
                label={`A 3D figure doing ${cfg.name.toLowerCase()} through its whole range, from rest to the latest session's best rep of ${deg(latest.bestPeakDeg)}`}
                fallback={<div className="hatch absolute inset-8" aria-hidden="true" />}
              />
            </div>
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
        <MuscleKey exercise={exercise} className="mt-3" />

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

        <Stagger>
          <Item>
            <StatTile
              label="Best range"
              icon={<IconTarget />}
              value={bestAll != null ? <AnimatedNumber value={bestAll} suffix="°" /> : none}
              hint={bestAll == null ? 'no sessions yet' : goal == null ? 'no goal set' : bestAll >= goal ? `goal of ${deg(goal)} reached` : `${deg(goal - bestAll)} short of the ${deg(goal)} goal`}
              tone={bestAll == null ? 'default' : goal != null && bestAll >= goal ? 'good' : 'primary'}
            />
          </Item>
          <Item>
            <StatTile label="Latest session" icon={<IconActivity />} value={latest ? <AnimatedNumber value={latest.bestPeakDeg} suffix="°" /> : none} hint={latest ? `${formatDate(latest.date)} · ${latest.totalReps} reps` : 'no session yet'} tone={latest ? 'primary' : 'default'} />
          </Item>
          <Item>
            <StatTile label="Sessions this week" icon={<IconCalendar />} value={data ? <AnimatedNumber value={thisWeek} /> : none} hint={data ? `${data.sessions.length} total for ${cfg.name.toLowerCase()}` : 'no sessions yet'} tone={thisWeek >= 3 ? 'good' : 'default'} />
          </Item>
          <Item>
            <StatTile label="Fatigue proxy" icon={<IconFlame />} value={latest ? <AnimatedNumber value={latest.fatigueIndex} decimals={2} /> : none} hint={fatigue ? fatigue.text : 'needs four reps in a set'} tone={fatigue ? fatigue.tone : 'default'} />
          </Item>
        </Stagger>

        {!noProfiles && !firstLoad && (
          <Link to="/plan" className="t-meta mt-4 flex items-center justify-between gap-3 text-ink-2 hover:no-underline">
            <span>
              {{ plan: 'Plan', week: 'This week', default: 'Suggested' }[prescription.source]} {prescription.sets} × {prescription.reps} · {prescription.restSeconds} s · {prescription.targetDeg}°
            </span>
            <span className="text-cobalt">{plan ? 'Plan & log →' : 'Set a plan →'}</span>
          </Link>
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
          {selected && !selected.intake && (
            <Link to={`/welcome?profile=${selected.id}`} className="t-label mt-3 inline-block text-cobalt">
              Tell Arc what you want from your body →
            </Link>
          )}
        </header>

        {error && (
          <div className="mb-6">
            <Alert tone="bad">{error}</Alert>
          </div>
        )}

        <RecordPanel prescription={prescription} />

        {selected && !noProfiles && <PlanCalendar profileId={selected.id} exercise={exercise} />}

        {noProfiles && (
          <Strip index="00" title="Setup">
            <EmptyState
              title="No profiles yet"
              description="A profile is one person who exercises; everyone in the household gets their own. Chat with Arc and it sets yours up with a week of training, add one yourself, or load the demo profile to see six weeks of readouts."
              action={
                <>
                  <Link className="btn btn-block" to="/welcome">
                    Tell Arc what you want
                  </Link>
                  <Link className="btn" to="/profiles">
                    Add a profile
                  </Link>
                  {demoButton(false)}
                </>
              }
            />
          </Strip>
        )}

        {noSignal && (
          <Strip index="02" title="Waiting for a session">
            <EmptyState
              title={`No sessions yet for ${cfg.name.toLowerCase()}`}
              description={
                <>
                  Press <strong>Start recording</strong> above: Arc counts {selected?.name ? <strong>{selected.name}</strong> : 'your'}
                  {selected?.name ? "'s" : ''} reps through the webcam, right in the browser, and the readout lands here as soon as the first set ends. Or switch movement in the panel, or load the demo data.
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

        {data && latest && (
          <Folds
            label="Charts, folded"
            items={chartFolds({ data, latest, goal, bestAll, thisWeek, metricLabel: cfg.metricLabel, name: cfg.name })}
          />
        )}
      </div>
    </Page>
  )
}

/** The dashboard's charts as folds, each row carrying its latest reading. */
function chartFolds({
  data,
  latest,
  goal,
  bestAll,
  thisWeek,
  metricLabel,
  name,
}: {
  data: ProgressDto
  latest: ProgressDto['sessions'][number]
  goal: number | null
  bestAll: number | null
  thisWeek: number
  metricLabel: string
  name: string
}): FoldItem[] {
  const points = data.sessions.map((s) => ({ label: formatDate(s.date), value: s.bestPeakDeg, sub: `${s.totalReps} reps` }))
  return [
    {
      id: 'peak',
      index: '02',
      title: `Peak ${metricLabel.toLowerCase()} per session`,
      summary: `${deg(bestAll)} best${goal != null ? ` · goal ${goal}°` : ''}`,
      render: () => <PeakChart progress={data} />,
    },
    {
      id: 'reps',
      index: '03',
      title: 'Latest session, rep by rep',
      summary: `${formatDate(latest.date)} · ${data.latestSessionReps.length} reps`,
      render: () => <RepChart progress={data} />,
    },
    {
      id: 'fatigue',
      index: '04',
      title: 'Fatigue per session',
      summary: `${latest.fatigueIndex.toFixed(2)} latest`,
      aside: 'ROM decay + tempo drift · a proxy, not a clinical measure',
      render: () => <FatigueChart progress={data} />,
    },
    {
      id: 'weekly',
      index: '05',
      title: 'Sessions per week',
      summary: `${thisWeek} this week`,
      aside: 'Consistency moves every other number',
      render: () => <WeeklyChart progress={data} />,
    },
    {
      id: '3d',
      index: '06',
      title: 'Peak per session, in 3D',
      summary: `${data.sessions.length} sessions`,
      aside: 'Drag to orbit · lighter is higher',
      render: () => (
        <div className="stage h-[260px] sm:h-[300px]">
          <LazyProgressScene
            points={points}
            goal={goal}
            className="h-full"
            label={`Best ${name.toLowerCase()} per session as 3D bars${goal != null ? ` against a ${goal} degree goal` : ''}`}
            fallback={<div className="hatch h-full" />}
          />
        </div>
      ),
    },
  ]
}
