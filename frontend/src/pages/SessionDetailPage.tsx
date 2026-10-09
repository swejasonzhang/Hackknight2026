import { EXERCISES, type SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { IconArrowLeft } from '../components/icons'
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
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/">
        <IconArrowLeft width={14} height={14} /> Dashboard
      </Link>
      <span>/</span>
      <span>Session</span>
    </nav>
  )

  if (error) {
    return (
      <div className="page">
        {back}
        <Alert tone="bad">{error}</Alert>
      </div>
    )
  }
  if (!session) {
    return (
      <div className="page">
        {back}
        <Skeleton height={40} width={320} />
        <div className="stat-grid" style={{ marginTop: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={96} />
          ))}
        </div>
      </div>
    )
  }

  const exercise = EXERCISES[session.exercise]
  const reps = session.sets.flatMap((set) => set.reps.map((r) => ({ label: `S${set.setNumber} R${r.index}`, peakDeg: r.peakDeg })))
  const yMax = Math.ceil(Math.max(session.plan.targetDeg, ...reps.map((r) => r.peakDeg), 10) / 10) * 10
  const fatigue = fatigueLabel(session.summary.fatigueIndex)
  const repInterval = Math.max(0, Math.ceil(reps.length / 16) - 1)
  const durationMin = Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))

  return (
    <div className="page">
      {back}
      <PageHeader
        eyebrow={formatDateTime(session.startedAt)}
        title={
          <>
            {exercise.name} <span className="muted">· {session.side}</span>
            {session.demo && <span className="badge">demo</span>}
          </>
        }
        subtitle={`${session.sets.length} sets · ${durationMin} min · planned ${session.plan.sets} × ${session.plan.reps} with ${session.plan.restSeconds} s rest`}
      />

      <div className="stat-grid">
        <StatTile label="Reps" value={session.summary.totalReps} hint={`${session.sets.length} sets`} />
        <StatTile
          label="Best rep"
          value={deg(session.summary.bestPeakDeg)}
          hint={session.summary.bestPeakDeg >= session.plan.targetDeg ? `goal of ${deg(session.plan.targetDeg)} reached` : `goal ${deg(session.plan.targetDeg)}`}
          tone={session.summary.bestPeakDeg >= session.plan.targetDeg ? 'good' : 'primary'}
        />
        <StatTile label="Mean rep" value={deg(session.summary.meanPeakDeg)} hint={exercise.metricLabel} />
        <StatTile label="Fatigue proxy" value={session.summary.fatigueIndex.toFixed(2)} hint={fatigue.text} tone={fatigue.tone} />
      </div>

      <Card title="Rep by rep" subtitle={`Peak ${exercise.metricLabel.toLowerCase()} for every rep; the dashed line is the goal.`}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={reps} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} interval={repInterval} axisLine={false} tickLine={false} />
            <YAxis domain={[0, yMax]} unit="°" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontSize: 13 }}
              formatter={(v) => `${Number(v).toFixed(0)}°`}
              cursor={{ fill: 'var(--surface-2)' }}
            />
            <Bar dataKey="peakDeg" name="Peak" fill="var(--chart-reps)" radius={[6, 6, 0, 0]} />
            <ReferenceLine y={session.plan.targetDeg} stroke="var(--chart-goal)" strokeDasharray="6 3" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ height: 18 }} />

      <Card title="Sets" subtitle="ROM drop and tempo drift compare the first and last reps of each set (needs at least 4 reps).">
        <div className="table-wrap">
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
                  <td>Set {s.setNumber}</td>
                  <td className="num">{s.reps.length}</td>
                  <td className="num">{deg(Math.max(...s.reps.map((r) => r.peakDeg)))}</td>
                  <td className="num">{s.fatigue.sampleReps >= 4 ? deg(s.fatigue.romDropDeg) : '–'}</td>
                  <td className="num">{s.fatigue.sampleReps >= 4 ? pct(s.fatigue.tempoDrift) : '–'}</td>
                  <td>{s.endedEarly ? <span className="badge" style={{ marginLeft: 0 }}>early</span> : 'as planned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
