import { FATIGUE_NUDGE, FATIGUE_STOP, type ProgressDto } from '@arc/dependencies'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../format'
import { Strip } from './ui'

interface Props {
  progress: ProgressDto
  metricLabel: string
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

/** Shared chart styles for the Calibre system: paper tooltip with a navy hairline, mono ticks. */
export const tooltipStyle = { background: 'var(--paper)', border: '1px solid var(--rule-strong)', borderRadius: 0, color: 'var(--ink)', fontSize: 12, fontFamily: MONO, boxShadow: 'none' }
export const axisTick = { fill: 'var(--chart-axis)', fontSize: 11, fontFamily: MONO }

const ruleLabel = (value: string, fill = 'var(--navy)') => ({ value, position: 'insideTopRight' as const, fill, fontSize: 10, fontFamily: MONO })

/** Square markers for the measured line, with a paper ring. */
function SquareDot({ cx, cy, index }: { cx?: number | string; cy?: number | string; index?: number }) {
  if (cx == null || cy == null) return null
  return <rect key={`sq-${index}`} x={Number(cx) - 3.5} y={Number(cy) - 3.5} width={7} height={7} fill="var(--chart-data)" stroke="var(--paper)" strokeWidth={1.5} />
}

function Legend({ items }: { items: { label: string; swatch: 'line' | 'dash' | 'rule' }[] }) {
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
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  )
}

/** Strips 01 to 04 of the dashboard's readout column: ruled sections, no card chrome. */
export function ProgressCharts({ progress, metricLabel }: Props) {
  const sessions = progress.sessions.map((s) => ({ ...s, label: formatDate(s.date) }))
  const reps = progress.latestSessionReps
  const goal = progress.targetDeg
  const peaks = [...sessions.map((s) => s.bestPeakDeg), ...sessions.map((s) => s.meanPeakDeg)]
  const lo = Math.max(0, Math.floor((Math.min(...peaks, goal ?? Infinity) - 10) / 10) * 10)
  const hi = Math.ceil(Math.max(goal ?? 0, ...peaks, ...reps.map((r) => r.peakDeg), 10) / 10) * 10
  const setStarts = reps.filter((r, i) => i > 0 && r.index === 1)
  const latest = sessions.at(-1)

  return (
    <>
      <Strip index="01" title={`Peak ${metricLabel.toLowerCase()} per session`} aside={goal != null ? `Goal ${goal}°` : 'No goal set'}>
        <div className="h-[240px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sessions} margin={{ top: 12, right: 28, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis domain={[lo, hi]} unit="°" tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} cursor={{ stroke: 'var(--navy)', strokeWidth: 1 }} />
              {goal != null && <ReferenceLine y={goal} stroke="var(--chart-goal)" strokeWidth={1} label={ruleLabel(`GOAL ${goal}°`)} />}
              <Line isAnimationActive={false} type="linear" dataKey="meanPeakDeg" name="Mean rep" stroke="var(--chart-data-2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line isAnimationActive={false} type="linear" dataKey="bestPeakDeg" name="Best rep" stroke="var(--chart-data)" strokeWidth={2} dot={SquareDot} activeDot={{ r: 5, fill: 'var(--chart-data)', stroke: 'var(--paper)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend items={[{ label: 'Best rep', swatch: 'line' }, { label: 'Mean rep', swatch: 'dash' }, ...(goal != null ? [{ label: `Goal ${goal}°`, swatch: 'rule' as const }] : [])]} />
      </Strip>

      <Strip index="02" title="Latest session, rep by rep" aside={latest ? `${latest.label} · ${reps.length} reps` : undefined}>
        <div className="h-[220px] sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reps} margin={{ top: 12, right: 28, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} interval="preserveStartEnd" minTickGap={18} />
              <YAxis domain={[0, hi]} unit="°" tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(0)}°`} cursor={{ fill: 'var(--vellum)' }} />
              {setStarts.map((r) => (
                <ReferenceLine key={r.label} x={r.label} stroke="var(--rule-strong)" strokeDasharray="2 3" label={{ value: `S${r.setNumber}`, position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 10, fontFamily: MONO }} />
              ))}
              {goal != null && <ReferenceLine y={goal} stroke="var(--chart-goal)" strokeWidth={1} label={ruleLabel(`GOAL ${goal}°`)} />}
              <Bar dataKey="peakDeg" name="Peak" fill="var(--chart-data)" maxBarSize={10} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Strip>

      <Strip index="03" title="Fatigue per session" aside="ROM decay + tempo drift · a proxy, not a clinical measure">
        <div className="h-[200px] sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sessions} margin={{ top: 12, right: 28, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis domain={[0, 0.5]} ticks={[0, FATIGUE_NUDGE, FATIGUE_STOP, 0.5]} tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(2)} cursor={{ stroke: 'var(--navy)', strokeWidth: 1 }} />
              <ReferenceLine y={FATIGUE_NUDGE} stroke="var(--warn)" strokeDasharray="4 3" label={ruleLabel(`NUDGE ${FATIGUE_NUDGE}`, 'var(--warn)')} />
              <ReferenceLine y={FATIGUE_STOP} stroke="var(--bad)" strokeDasharray="4 3" label={ruleLabel(`EARLY REST ${FATIGUE_STOP}`, 'var(--bad)')} />
              <Line isAnimationActive={false} type="linear" dataKey="fatigueIndex" name="Fatigue proxy" stroke="var(--chart-data-2)" strokeWidth={1.5} dot={{ r: 2.5, fill: 'var(--chart-data-2)', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Strip>

      <Strip index="04" title="Sessions per week" aside="Consistency moves every other number">
        <div className="h-[180px] sm:h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={progress.sessionsPerWeek} margin={{ top: 12, right: 28, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="weekStart" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--rule-strong)' }} tickFormatter={(w: string) => formatDate(Date.parse(`${w}T12:00:00Z`))} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--vellum)' }} labelFormatter={(w) => `Week of ${formatDate(Date.parse(`${w}T12:00:00Z`))}`} />
              <Bar dataKey="count" name="Sessions" fill="var(--chart-data-2)" maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Strip>
    </>
  )
}
