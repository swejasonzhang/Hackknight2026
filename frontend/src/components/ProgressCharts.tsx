import { FATIGUE_NUDGE, FATIGUE_STOP, type ProgressDto } from '@ptg/dependencies'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../format'

interface Props {
  progress: ProgressDto
  metricLabel: string
}

const colors = { best: '#4f8df7', mean: '#9ab4e8', target: '#f2a541', fatigue: '#e8734a', reps: '#5cc8a0', weeks: '#8b7cf6' }

export function ProgressCharts({ progress, metricLabel }: Props) {
  const sessions = progress.sessions.map((s) => ({ ...s, label: formatDate(s.date) }))
  const yMax = Math.max(progress.targetDeg ?? 0, ...sessions.map((s) => s.bestPeakDeg), ...progress.latestSessionReps.map((r) => r.peakDeg), 10)

  if (sessions.length === 0) {
    return <p className="muted">No sessions for this exercise yet. Run one on the Session page or load demo data.</p>
  }

  return (
    <div className="charts">
      <div className="card">
        <h3>Peak {metricLabel.toLowerCase()} per session</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={sessions} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" />
            <XAxis dataKey="label" stroke="#9aa4b5" />
            <YAxis domain={[0, Math.ceil(yMax / 10) * 10]} unit="°" stroke="#9aa4b5" />
            <Tooltip formatter={(v) => `${Number(v).toFixed(0)}°`} />
            <Legend />
            <Line type="monotone" dataKey="bestPeakDeg" name="Best rep" stroke={colors.best} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="meanPeakDeg" name="Mean rep" stroke={colors.mean} strokeDasharray="4 3" dot={false} />
            {progress.targetDeg != null && (
              <ReferenceLine y={progress.targetDeg} stroke={colors.target} strokeDasharray="6 3" label={{ value: `goal ${progress.targetDeg}°`, fill: colors.target, position: 'insideTopRight' }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Latest session, rep by rep</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={progress.latestSessionReps} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" />
            <XAxis dataKey="label" stroke="#9aa4b5" interval={0} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, Math.ceil(yMax / 10) * 10]} unit="°" stroke="#9aa4b5" />
            <Tooltip formatter={(v) => `${Number(v).toFixed(0)}°`} />
            <Bar dataKey="peakDeg" name="Peak" fill={colors.reps} />
            {progress.targetDeg != null && <ReferenceLine y={progress.targetDeg} stroke={colors.target} strokeDasharray="6 3" />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Fatigue proxy per session</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={sessions} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" />
            <XAxis dataKey="label" stroke="#9aa4b5" />
            <YAxis domain={[0, 0.5]} stroke="#9aa4b5" />
            <Tooltip formatter={(v) => Number(v).toFixed(2)} />
            <ReferenceLine y={FATIGUE_NUDGE} stroke="#f2a541" strokeDasharray="4 3" label={{ value: 'nudge', fill: '#f2a541', position: 'insideTopLeft' }} />
            <ReferenceLine y={FATIGUE_STOP} stroke="#e8734a" strokeDasharray="4 3" label={{ value: 'early rest', fill: '#e8734a', position: 'insideTopLeft' }} />
            <Line type="monotone" dataKey="fatigueIndex" name="ROM decay + tempo drift" stroke={colors.fatigue} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="muted small">A proxy: how much range and tempo fell between the first and last reps of each set. Not a clinical measure.</p>
      </div>

      <div className="card">
        <h3>Sessions per week</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={progress.sessionsPerWeek} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" />
            <XAxis dataKey="weekStart" stroke="#9aa4b5" tickFormatter={(w: string) => formatDate(Date.parse(`${w}T12:00:00Z`))} />
            <YAxis allowDecimals={false} stroke="#9aa4b5" />
            <Tooltip />
            <Bar dataKey="count" name="Sessions" fill={colors.weeks} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
