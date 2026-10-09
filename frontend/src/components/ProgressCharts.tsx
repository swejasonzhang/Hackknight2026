import { FATIGUE_NUDGE, FATIGUE_STOP, type ProgressDto } from '@arc/dependencies'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../format'
import { Item, Stagger } from './motion'
import { Card } from './ui'

interface Props {
  progress: ProgressDto
  metricLabel: string
}

export const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow-pop)' }
export const axisTick = { fill: 'var(--chart-axis)', fontSize: 12, fontWeight: 600 }

export function ProgressCharts({ progress, metricLabel }: Props) {
  const sessions = progress.sessions.map((s) => ({ ...s, label: formatDate(s.date) }))
  const yMax = Math.ceil(Math.max(progress.targetDeg ?? 0, ...sessions.map((s) => s.bestPeakDeg), ...progress.latestSessionReps.map((r) => r.peakDeg), 10) / 10) * 10
  const goal = progress.targetDeg

  return (
    <Stagger className="mb-5 grid gap-5 md:grid-cols-2">
      <Item>
        <Card title={`Peak ${metricLabel.toLowerCase()} per session`} subtitle={goal != null ? `Goal ${goal}°` : 'No goal set yet'}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={sessions} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis domain={[0, yMax]} unit="°" tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="bestPeakDeg" name="Best rep" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3.5, strokeWidth: 0, fill: 'var(--chart-1)' }} activeDot={{ r: 6 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="meanPeakDeg" name="Mean rep" stroke="var(--chart-1-soft)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              {goal != null && <ReferenceLine y={goal} stroke="var(--chart-goal)" strokeDasharray="6 3" label={{ value: `goal ${goal}°`, fill: 'var(--chart-goal)', fontSize: 12, fontWeight: 700, position: 'insideTopLeft' }} />}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Item>

      <Item>
        <Card title="Latest session, rep by rep" subtitle="Each bar is one rep's peak; the dashed line is the goal">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={progress.latestSessionReps} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} axisLine={false} tickLine={false} />
              <YAxis domain={[0, yMax]} unit="°" tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar dataKey="peakDeg" name="Peak" fill="var(--chart-reps)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
              {goal != null && <ReferenceLine y={goal} stroke="var(--chart-goal)" strokeDasharray="6 3" />}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Item>

      <Item>
        <Card title="Fatigue proxy per session" subtitle="ROM decay + tempo drift within sets. Dashed lines: 0.12 nudge, 0.25 early rest. Not a clinical measure.">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={sessions} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 0.5]} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(2)} />
              <ReferenceLine y={FATIGUE_NUDGE} stroke="var(--warn)" strokeDasharray="4 3" />
              <ReferenceLine y={FATIGUE_STOP} stroke="var(--bad)" strokeDasharray="4 3" />
              <Line isAnimationActive={false} type="monotone" dataKey="fatigueIndex" name="Fatigue proxy" stroke="var(--chart-fatigue)" strokeWidth={3} dot={{ r: 3.5, strokeWidth: 0, fill: 'var(--chart-fatigue)' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Item>

      <Item>
        <Card title="Sessions per week" subtitle="Consistency beats intensity">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={progress.sessionsPerWeek} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="weekStart" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(w: string) => formatDate(Date.parse(`${w}T12:00:00Z`))} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} labelFormatter={(w) => `Week of ${formatDate(Date.parse(`${w}T12:00:00Z`))}`} />
              <Bar dataKey="count" name="Sessions" fill="var(--chart-weeks)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Item>
    </Stagger>
  )
}
