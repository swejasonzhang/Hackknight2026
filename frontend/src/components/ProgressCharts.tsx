import { FATIGUE_NUDGE, FATIGUE_STOP, type ProgressDto } from '@arc/dependencies'
import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../format'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

/** Shared chart styles for the Calibre system: paper tooltip with a navy hairline, mono ticks. */
export const tooltipStyle = { background: 'var(--paper)', border: '1px solid var(--rule-strong)', borderRadius: 0, color: 'var(--ink)', fontSize: 12, fontFamily: MONO, boxShadow: 'none' }
export const axisTick = { fill: 'var(--chart-axis)', fontSize: 11, fontFamily: MONO }

const MARGIN = { top: 12, right: 28, left: -8, bottom: 0 }
const ruleLabel = (value: string, fill = 'var(--navy)') => ({ value, position: 'insideTopRight' as const, fill, fontSize: 10, fontFamily: MONO })

/** Square markers for the measured line, with a paper ring. */
function SquareDot({ cx, cy, index }: { cx?: number | string; cy?: number | string; index?: number }) {
  if (cx == null || cy == null) return null
  return <rect key={`sq-${index}`} x={Number(cx) - 3.5} y={Number(cy) - 3.5} width={7} height={7} fill="var(--chart-data)" stroke="var(--paper)" strokeWidth={1.5} />
}

export function ChartLegend({ items }: { items: { label: string; swatch: 'line' | 'dash' | 'rule' | 'bar' }[] }) {
  return (
    <ul className="t-meta mt-3 flex flex-wrap gap-x-6 gap-y-2" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            {it.swatch === 'line' && (
              <>
                <line x1="0" y1="4" x2="22" y2="4" stroke="var(--chart-data)" strokeWidth="2" />
                <rect x="7.5" y="0.5" width="7" height="7" fill="var(--chart-data)" />
              </>
            )}
            {it.swatch === 'dash' && <line x1="0" y1="4" x2="22" y2="4" stroke="var(--chart-data-2)" strokeWidth="1.5" strokeDasharray="4 3" />}
            {it.swatch === 'rule' && <line x1="0" y1="4" x2="22" y2="4" stroke="var(--chart-goal)" strokeWidth="1" />}
            {it.swatch === 'bar' && <rect x="7" y="0" width="8" height="8" fill="var(--chart-data)" />}
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  )
}

function useBounds(progress: ProgressDto) {
  const sessions = progress.sessions.map((s) => ({ ...s, label: formatDate(s.date) }))
  const goal = progress.targetDeg
  const peaks = [...sessions.map((s) => s.bestPeakDeg), ...sessions.map((s) => s.meanPeakDeg)]
  const lo = Math.max(0, Math.floor((Math.min(...peaks, goal ?? Infinity) - 10) / 10) * 10)
  const hi = Math.ceil(Math.max(goal ?? 0, ...peaks, ...progress.latestSessionReps.map((r) => r.peakDeg), 10) / 10) * 10
  return { sessions, goal, lo, hi }
}

/** Best and mean rep per session against the goal rule. Draws itself in; animates between datasets. */
export function PeakChart({ progress, height = 280, legend = true }: { progress: ProgressDto; height?: number; legend?: boolean }) {
  const reduce = useReducedMotion()
  const { sessions, goal, lo, hi } = useBounds(progress)
  return (
    <>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sessions} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis domain={[lo, hi]} unit="°" tick={axisTick} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} cursor={{ stroke: 'var(--navy)', strokeWidth: 1 }} />
            {goal != null && <ReferenceLine y={goal} stroke="var(--chart-goal)" strokeWidth={1} label={ruleLabel(`GOAL ${goal}°`)} />}
            <Line isAnimationActive={!reduce} animationDuration={900} type="linear" dataKey="meanPeakDeg" name="Mean rep" stroke="var(--chart-data-2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Line isAnimationActive={!reduce} animationDuration={1100} type="linear" dataKey="bestPeakDeg" name="Best rep" stroke="var(--chart-data)" strokeWidth={2} dot={SquareDot} activeDot={{ r: 5, fill: 'var(--chart-data)', stroke: 'var(--paper)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {legend && <ChartLegend items={[{ label: 'Best rep', swatch: 'line' }, { label: 'Mean rep', swatch: 'dash' }, ...(goal != null ? [{ label: `Goal ${goal}°`, swatch: 'rule' as const }] : [])]} />}
    </>
  )
}

/** Every rep of the latest session as thin bars, set boundaries marked, the goal as a rule. */
export function RepChart({ progress, height = 240 }: { progress: ProgressDto; height?: number }) {
  const reduce = useReducedMotion()
  const { goal, hi } = useBounds(progress)
  const reps = progress.latestSessionReps
  const setStarts = reps.filter((r, i) => i > 0 && r.index === 1)
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={reps} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis domain={[0, hi]} unit="°" tick={axisTick} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} cursor={{ fill: 'var(--vellum)' }} />
          {setStarts.map((r) => (
            <ReferenceLine key={r.label} x={r.label} stroke="var(--rule-strong)" strokeDasharray="2 3" label={{ value: `S${r.setNumber}`, position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 10, fontFamily: MONO }} />
          ))}
          {goal != null && <ReferenceLine y={goal} stroke="var(--chart-goal)" strokeWidth={1} label={ruleLabel(`GOAL ${goal}°`)} />}
          <Bar dataKey="peakDeg" name="Peak" fill="var(--chart-data)" maxBarSize={10} isAnimationActive={!reduce} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** The fatigue proxy per session with the nudge and early-rest thresholds. */
export function FatigueChart({ progress, height = 220 }: { progress: ProgressDto; height?: number }) {
  const reduce = useReducedMotion()
  const { sessions } = useBounds(progress)
  // Fit the axis to the data, but never so tight that the early-rest rule falls off the top.
  const worst = Math.max(0, ...sessions.map((s) => s.fatigueIndex))
  const top = Math.max(0.3, Math.ceil((worst * 1.15) / 0.05) * 0.05)
  const ticks = top > 0.35 ? [0, FATIGUE_NUDGE, FATIGUE_STOP, Number(top.toFixed(2))] : [0, FATIGUE_NUDGE, FATIGUE_STOP]
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sessions} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[0, Number(top.toFixed(2))]} ticks={ticks} tick={axisTick} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(2)} cursor={{ stroke: 'var(--navy)', strokeWidth: 1 }} />
          <ReferenceLine y={FATIGUE_NUDGE} stroke="var(--warn)" strokeDasharray="4 3" label={ruleLabel(`NUDGE ${FATIGUE_NUDGE}`, 'var(--warn)')} />
          <ReferenceLine y={FATIGUE_STOP} stroke="var(--bad)" strokeDasharray="4 3" label={ruleLabel(`EARLY REST ${FATIGUE_STOP}`, 'var(--bad)')} />
          <Line isAnimationActive={!reduce} animationDuration={1000} type="linear" dataKey="fatigueIndex" name="Fatigue proxy" stroke="var(--chart-data-2)" strokeWidth={1.5} dot={{ r: 2.5, fill: 'var(--chart-data-2)', strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Sessions per week as navy bars: consistency at a glance. */
export function WeeklyChart({ progress, height = 200 }: { progress: ProgressDto; height?: number }) {
  const reduce = useReducedMotion()
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={progress.sessionsPerWeek} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="weekStart" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} tickFormatter={(w: string) => formatDate(Date.parse(`${w}T12:00:00Z`))} />
          <YAxis allowDecimals={false} domain={[0, 4]} tick={axisTick} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--vellum)' }} labelFormatter={(w) => `Week of ${formatDate(Date.parse(`${w}T12:00:00Z`))}`} />
          <Bar dataKey="count" name="Sessions" fill="var(--chart-data-2)" maxBarSize={36} isAnimationActive={!reduce} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
