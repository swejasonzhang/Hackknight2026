import { EXERCISES, FATIGUE_MIN_REPS, sideLabel, type SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { AnimatedNumber, Page } from '../components/motion'
import { axisTick, tooltipStyle } from '../components/ProgressCharts'
import { ArcRead } from '../components/ArcRead'
import { LazyJointScene } from '../components/three/lazy'
import { useRepLoop } from '../components/three/useRepLoop'
import { Alert, Lamp, Skeleton, StatTile, Strip, Tag } from '../components/ui'
import { deg, fatigueLabel, formatDateTime, pct } from '../format'
import { useStickyTop } from '../components/useStickyTop'
import { MuscleKey } from '../components/MuscleKey'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

/* Desktop is a 4:8 report: the stage column (cols 1-4) is sticky beside the report column
 * (cols 5-12). On a phone the same blocks stack in reading order: title, numeral, stage, readouts, strips. */
const GRID = 'grid gap-x-8 gap-y-6 lg:grid-cols-12 lg:gap-y-0'
const AREA = {
  back: 'lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:pb-5',
  title: 'border-b border-rule-strong pb-5 lg:col-span-8 lg:col-start-5 lg:row-start-1',
  numeral: 'lg:col-span-4 lg:col-start-5 lg:row-start-2 lg:pt-6 lg:pb-8',
  stage: 'lg:col-span-4 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:sticky lg:self-start',
  readouts: 'lg:col-span-4 lg:col-start-9 lg:row-start-2 lg:border-l lg:border-rule lg:pt-6 lg:pb-8 lg:pl-8',
  strips: 'lg:col-span-8 lg:col-start-5 lg:row-start-3',
}

/** A lane label (S1, S2, S3) drawn in the top margin just right of a set-boundary rule. */
function laneLabel(text: string) {
  return ({ viewBox }: { viewBox?: { x?: number; y?: number } }) => (
    <text x={(viewBox?.x ?? 0) + 6} y={(viewBox?.y ?? 0) - 8} fill="var(--navy)" fontFamily={MONO} fontSize={10.5} fontWeight={500} letterSpacing="0.1em">
      {text}
    </text>
  )
}

/** A square mono tag riding the right end of the goal rule. */
function goalTag(text: string) {
  const width = Math.round(text.length * 6.6) + 14
  return ({ viewBox }: { viewBox?: { x?: number; y?: number; width?: number } }) => {
    const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - width - 2
    const y = (viewBox?.y ?? 0) - 9
    return (
      <g>
        <rect x={x} y={y} width={width} height={18} fill="var(--paper)" stroke="var(--navy)" />
        <text x={x + width / 2} y={y + 12.5} textAnchor="middle" fill="var(--navy)" fontFamily={MONO} fontSize={10.5} fontWeight={500} letterSpacing="0.08em">
          {text.toUpperCase()}
        </text>
      </g>
    )
  }
}

/** Where "back" goes: the page the session was opened from (the plan's log, on the same day), else the plan. */
function useBack(): { to: string; label: string } {
  const state = useLocation().state as { from?: unknown; label?: unknown } | null
  if (state && typeof state.from === 'string' && state.from.startsWith('/') && !state.from.startsWith('//') && typeof state.label === 'string') {
    return { to: state.from, label: state.label }
  }
  return { to: '/plan', label: 'Plan' }
}

function BackLink() {
  const back = useBack()
  return (
    <nav className={AREA.back} aria-label="Breadcrumb">
      <Link to={back.to} className="t-label inline-flex items-center gap-2 text-navy hover:text-cobalt">
        ← {back.label}
      </Link>
    </nav>
  )
}

/** One stored session as a lab report: the sticky stage and spec list, then the readout and the strips. */
export function SessionDetailPage() {
  const { id = '' } = useParams()
  const back = useBack()
  // Straight after a recording, Arc reads the session aloud.
  const arcRead = Boolean((useLocation().state as { arcRead?: boolean } | null)?.arcRead)
  const [stageRef, stageTop] = useStickyTop<HTMLElement>(24)
  const [session, setSession] = useState<SessionDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The figure works through the whole range, rep after rep: from rest to this session's best and back.
  const loop = useRepLoop(session?.exercise ?? 'elbow_flexion', session ? session.summary.bestPeakDeg : null)

  useEffect(() => {
    let cancelled = false
    api.sessions
      .get(id)
      .then((s) => {
        if (!cancelled) setSession(s)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the session')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <Page className={GRID}>
        <BackLink />
        <div className="lg:col-span-8 lg:col-start-5 lg:row-start-1">
          <Alert tone="bad">{error}</Alert>
        </div>
      </Page>
    )
  }

  if (!session) {
    return (
      <Page className={GRID}>
        <p className="sr-only" role="status">
          Loading session…
        </p>
        <BackLink />
        <div className={AREA.title} aria-hidden="true">
          <Skeleton height={14} width={200} />
          <Skeleton height={48} width="70%" className="mt-4" />
        </div>
        <div className={AREA.numeral} aria-hidden="true">
          <Skeleton height={80} width={220} />
          <Skeleton height={12} width={170} className="mt-4" />
        </div>
        <aside className={AREA.stage} aria-hidden="true">
          <div className="panel">
            <div className="stage h-[280px] lg:h-[340px]" />
          </div>
        </aside>
        <div className={AREA.readouts} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={44} className="mt-3" />
          ))}
        </div>
        <div className={AREA.strips} aria-hidden="true">
          <div className="strip">
            <Skeleton height={240} />
          </div>
          <div className="strip">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={44} className="mt-2" />
            ))}
          </div>
        </div>
      </Page>
    )
  }

  const exercise = EXERCISES[session.exercise]
  const goal = session.plan.targetDeg
  const best = session.summary.bestPeakDeg
  const goalReached = best >= goal
  const fatigue = fatigueLabel(session.summary.fatigueIndex)
  const durationMin = Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))
  const reps = session.sets.flatMap((set) => set.reps.map((r) => ({ label: `S${set.setNumber} R${r.index}`, peakDeg: r.peakDeg })))
  const setStarts = session.sets.flatMap((set) => {
    const first = set.reps[0]
    return first ? [{ setNumber: set.setNumber, label: `S${set.setNumber} R${first.index}` }] : []
  })
  const yMax = Math.ceil(Math.max(goal, ...reps.map((r) => r.peakDeg), 10) / 10) * 10
  const spec: [string, string][] = [
    ['Exercise', exercise.name],
    ['Side', session.side],
    ['Plan', `${session.plan.sets} × ${session.plan.reps} · ${session.plan.restSeconds} s rest`],
    ['Duration', `${durationMin} min`],
    ['Sets', String(session.sets.length)],
  ]

  return (
    <Page className={GRID}>
      {/* Report head: the way back, timestamp, DEMO tag, the exercise title with the side after a middle dot. */}
      <header className={AREA.title}>
        <div className="t-meta flex flex-wrap items-center gap-3">
          <Link to={back.to} className="t-label inline-flex items-center gap-2 text-navy hover:text-cobalt">
            ← {back.label}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{formatDateTime(session.startedAt)}</span>
          {session.demo && <Tag soft>Demo</Tag>}
          {session.complete === false && <Tag soft>Stopped early</Tag>}
        </div>
        {session.complete === false && (
          <p className="t-desc mt-3 max-w-[62ch] text-[14px]">
            This recording stopped before its last set. Every set that finished was saved as it ended, so {session.sets.length === 1 ? 'its set is' : `its ${session.sets.length} sets are`} all here.
          </p>
        )}
        <h1 className="t-title mt-3">
          {exercise.name} <span className="font-medium text-muted">· {sideLabel(session.exercise, session.side)}</span>
        </h1>
      </header>

      {/* The one big readout on this page. */}
      <div className={AREA.numeral}>
        <div className="t-readout">
          <AnimatedNumber value={best} suffix="°" />
        </div>
        <div className="t-meta mt-4 flex items-center gap-2 text-ink-2">
          {goalReached ? (
            <>
              <Lamp tone="good" /> Goal {deg(goal)} reached
            </>
          ) : (
            <>
              Best rep · goal {deg(goal)}
            </>
          )}
        </div>
      </div>

      {/* Stage column: the limb posed at the best rep on the blueprint grid, then the spec list. */}
      <aside ref={stageRef} className={`${AREA.stage} grid gap-5 sm:grid-cols-2 lg:grid-cols-1`} style={{ top: stageTop }} aria-label="Session stage">
        <div className="panel">
          <div className="stage h-[280px] sm:h-[300px] lg:h-[340px]">
            <div className="absolute inset-x-0 top-11 bottom-0">
              <LazyJointScene
                exercise={session.exercise}
                angle={loop ?? best}
                rangeDeg={best}
                goalDeg={goal}
                mirrored={exercise.sided && session.side === 'left'}
                className="h-full w-full"
                label={`A 3D figure doing ${exercise.name.toLowerCase()} through its whole range, from rest to this session's best rep of ${deg(best)}`}
                fallback={<div aria-hidden="true" className="hatch absolute inset-8" />}
              />
            </div>
            <span className="callout pointer-events-none top-3 left-3">Best rep · {exercise.metricLabel}</span>
            <span className="callout pointer-events-none top-3 right-3">Goal {deg(goal)}</span>
          </div>
          <MuscleKey exercise={session.exercise} className="border-t border-rule p-4" />
        </div>
        <dl className="border-t border-rule-strong">
          {spec.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
              <dt className="t-label">{k}</dt>
              <dd className="t-mono text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </aside>

      {/* Secondary readouts, a three-row ledger beside the numeral. */}
      <div className={AREA.readouts}>
        <StatTile label="Reps" value={<AnimatedNumber value={session.summary.totalReps} />} hint={`${session.sets.length} ${session.sets.length === 1 ? 'set' : 'sets'}`} tone="primary" />
        <StatTile label="Mean rep" value={<AnimatedNumber value={session.summary.meanPeakDeg} suffix="°" />} hint={exercise.metricLabel} />
        <StatTile label="Fatigue proxy" value={<AnimatedNumber value={session.summary.fatigueIndex} decimals={2} />} hint={fatigue.text} tone={fatigue.tone} />
      </div>

      <div className={AREA.strips}>
        <ArcRead session={session} autoSpeak={arcRead} />
        <Strip index="01" title="Rep by rep, by set" aside={`Peak ${exercise.metricLabel.toLowerCase()} · ${reps.length} reps`}>
          <div className="h-[240px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reps} margin={{ top: 28, right: 16, left: -12, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tickFormatter={(v: string) => v.replace(/^S\d+\s/, '')} tick={{ ...axisTick, fontSize: 11, fontFamily: MONO }} interval="preserveStartEnd" minTickGap={14} axisLine={false} tickLine={false} />
                <YAxis domain={[0, yMax]} unit="°" tick={{ ...axisTick, fontFamily: MONO }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} cursor={{ fill: 'var(--vellum)' }} />
                <Bar dataKey="peakDeg" name="Peak" fill="var(--chart-data)" maxBarSize={12} isAnimationActive={false} />
                {setStarts.map((s, i) => (
                  <ReferenceLine key={s.setNumber} x={s.label} position="start" stroke={i === 0 ? 'none' : 'var(--chart-goal)'} label={laneLabel(`S${s.setNumber}`)} />
                ))}
                <ReferenceLine y={goal} stroke="var(--chart-goal)" label={goalTag(`Goal ${deg(goal)}`)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Strip>

        <Strip index="02" title="Sets" aside={`${session.sets.length} of ${session.plan.sets} planned`}>
          <table className="ledger">
            <thead>
              <tr>
                <th>Set</th>
                <th className="num">Reps</th>
                <th className="num">Best</th>
                <th className="num hidden sm:table-cell">ROM drop</th>
                <th className="num hidden sm:table-cell">Tempo drift</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {session.sets.map((s) => {
                const enough = s.fatigue.sampleReps >= FATIGUE_MIN_REPS
                const setBest = s.reps.length > 0 ? Math.max(...s.reps.map((r) => r.peakDeg)) : null
                const drop = enough ? deg(s.fatigue.romDropDeg) : '–'
                const drift = enough ? pct(s.fatigue.tempoDrift) : '–'
                return (
                  <tr key={s.setNumber}>
                    <td className="font-mono text-[12.5px] font-medium text-navy">
                      {String(s.setNumber).padStart(2, '0')}
                      <div className="t-meta mt-1 normal-case sm:hidden">
                        drop {drop} · drift {drift}
                      </div>
                    </td>
                    <td className="num">{s.reps.length}</td>
                    <td className="num font-medium text-navy">{deg(setBest)}</td>
                    <td className={`num hidden sm:table-cell ${enough ? '' : 'text-muted'}`}>{drop}</td>
                    <td className={`num hidden sm:table-cell ${enough ? '' : 'text-muted'}`}>{drift}</td>
                    <td>
                      <span className="t-meta flex items-center gap-2 text-ink-2">
                        <Lamp tone={s.endedEarly ? 'warn' : 'default'} />
                        {s.endedEarly ? 'Early' : 'As planned'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="t-desc mt-3">ROM drop and tempo drift compare the first and last reps of each set, so a set needs at least {FATIGUE_MIN_REPS} reps to read them.</p>
        </Strip>
      </div>
    </Page>
  )
}
