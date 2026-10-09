import { EXERCISES, type SessionDto } from '@ptg/dependencies'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { deg, formatDateTime, pct } from '../format'

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

  if (error) return <p className="error">{error}</p>
  if (!session) return <p className="muted">Loading…</p>

  const exercise = EXERCISES[session.exercise]
  const reps = session.sets.flatMap((set) => set.reps.map((r) => ({ label: `S${set.setNumber} R${r.index}`, peakDeg: r.peakDeg })))
  const yMax = Math.ceil(Math.max(session.plan.targetDeg, ...reps.map((r) => r.peakDeg), 10) / 10) * 10

  return (
    <div className="page">
      <header className="page-header">
        <h2>
          {exercise.name} · {session.side}
        </h2>
        <span className="muted">{formatDateTime(session.startedAt)}</span>
        {session.demo && <span className="badge">demo</span>}
        <Link to="/" className="muted small">
          Back to dashboard
        </Link>
      </header>

      <div className="card">
        <p>
          {session.summary.totalReps} reps in {session.sets.length} sets. Best {deg(session.summary.bestPeakDeg)}, mean {deg(session.summary.meanPeakDeg)}, goal{' '}
          {deg(session.plan.targetDeg)}. Fatigue proxy {session.summary.fatigueIndex.toFixed(2)}.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reps} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" />
            <XAxis dataKey="label" stroke="#9aa4b5" interval={0} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, yMax]} unit="°" stroke="#9aa4b5" />
            <Tooltip formatter={(v) => `${Number(v).toFixed(0)}°`} />
            <Bar dataKey="peakDeg" name={`Peak ${exercise.metricLabel.toLowerCase()}`} fill="#5cc8a0" />
            <ReferenceLine y={session.plan.targetDeg} stroke="#f2a541" strokeDasharray="6 3" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Sets</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Set</th>
              <th>Reps</th>
              <th>Best</th>
              <th>ROM drop</th>
              <th>Tempo drift</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {session.sets.map((s) => (
              <tr key={s.setNumber}>
                <td>{s.setNumber}</td>
                <td>{s.reps.length}</td>
                <td>{deg(Math.max(...s.reps.map((r) => r.peakDeg)))}</td>
                <td>{s.fatigue.sampleReps >= 4 ? deg(s.fatigue.romDropDeg) : '–'}</td>
                <td>{s.fatigue.sampleReps >= 4 ? pct(s.fatigue.tempoDrift) : '–'}</td>
                <td>{s.endedEarly ? 'early' : 'planned'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
