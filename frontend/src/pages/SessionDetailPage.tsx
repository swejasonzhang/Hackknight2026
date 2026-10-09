import { EXERCISES, type SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { IconArrowLeft } from '../components/icons'
import { AnimatedNumber, Item, Page, Stagger } from '../components/motion'
import { axisTick, tooltipStyle } from '../components/ProgressCharts'
import { Alert, Card, PageHeader, Skeleton, StatTile } from '../components/ui'
import { deg, fatigueLabel, formatDateTime, pct } from '../format'

/** One stored session, set by set and rep by rep. */
export function SessionDetailPage() {
  const { id = '' } = useParams()
  const [session, setSession] = useState<SessionDto | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const back = (
    <nav className="mb-3 flex items-center gap-1.5 text-[13px] text-muted" aria-label="Breadcrumb">
      <Link to="/" className="inline-flex items-center gap-1">
        <IconArrowLeft width={14} height={14} /> Dashboard
      </Link>
      <span>/</span>
      <span>Session</span>
    </nav>
  )

  if (error) {
    return (
      <Page>
        {back}
        <Alert tone="bad">{error}</Alert>
      </Page>
    )
  }
  if (!session) {
    return (
      <Page>
        {back}
        <Skeleton height={40} width={320} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={104} />
          ))}
        </div>
      </Page>
    )
  }

  const exercise = EXERCISES[session.exercise]
  const reps = session.sets.flatMap((set) => set.reps.map((r) => ({ label: `S${set.setNumber} R${r.index}`, peakDeg: r.peakDeg })))
  const yMax = Math.ceil(Math.max(session.plan.targetDeg, ...reps.map((r) => r.peakDeg), 10) / 10) * 10
  const fatigue = fatigueLabel(session.summary.fatigueIndex)
  const durationMin = Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))
  const goalReached = session.summary.bestPeakDeg >= session.plan.targetDeg

  return (
    <Page>
      {back}
      <PageHeader
        eyebrow={formatDateTime(session.startedAt)}
        title={
          <>
            {exercise.name} <span className="font-medium text-muted">· {session.side}</span>
            {session.demo && <span className="badge">demo</span>}
          </>
        }
        subtitle={`${session.sets.length} sets · ${durationMin} min · planned ${session.plan.sets} × ${session.plan.reps} with ${session.plan.restSeconds} s rest`}
      />

      <Stagger className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Item>
          <StatTile label="Reps" value={<AnimatedNumber value={session.summary.totalReps} />} hint={`${session.sets.length} sets`} />
        </Item>
        <Item>
          <StatTile label="Best rep" value={<AnimatedNumber value={session.summary.bestPeakDeg} suffix="°" />} hint={goalReached ? `goal of ${deg(session.plan.targetDeg)} reached` : `goal ${deg(session.plan.targetDeg)}`} tone={goalReached ? 'good' : 'primary'} />
        </Item>
        <Item>
          <StatTile label="Mean rep" value={<AnimatedNumber value={session.summary.meanPeakDeg} suffix="°" />} hint={exercise.metricLabel} />
        </Item>
        <Item>
          <StatTile label="Fatigue proxy" value={<AnimatedNumber value={session.summary.fatigueIndex} decimals={2} />} hint={fatigue.text} tone={fatigue.tone} />
        </Item>
      </Stagger>

      <div className="flex flex-col gap-5">
        <Card title="Rep by rep" subtitle={`Peak ${exercise.metricLabel.toLowerCase()} for every rep; the dashed line is the goal.`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reps} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} axisLine={false} tickLine={false} />
              <YAxis domain={[0, yMax]} unit="°" tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar dataKey="peakDeg" name="Peak" fill="var(--chart-reps)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <ReferenceLine y={session.plan.targetDeg} stroke="var(--chart-goal)" strokeDasharray="6 3" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sets" subtitle="ROM drop and tempo drift compare the first and last reps of each set (needs at least 4 reps).">
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th className="num">Reps</th>
                  <th className="num">Best</th>
                  <th className="num">ROM drop</th>
                  <th className="num">Tempo drift</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {session.sets.map((s) => (
                  <tr key={s.setNumber}>
                    <td className="font-medium">Set {s.setNumber}</td>
                    <td className="num">{s.reps.length}</td>
                    <td className="num">{deg(Math.max(...s.reps.map((r) => r.peakDeg)))}</td>
                    <td className="num">{s.fatigue.sampleReps >= 4 ? deg(s.fatigue.romDropDeg) : '–'}</td>
                    <td className="num">{s.fatigue.sampleReps >= 4 ? pct(s.fatigue.tempoDrift) : '–'}</td>
                    <td>{s.endedEarly ? <span className="badge ml-0">early</span> : <span className="text-muted">as planned</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Page>
  )
}
