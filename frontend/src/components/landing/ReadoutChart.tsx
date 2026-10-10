import { EXERCISES } from '@arc/dependencies'
import { useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'

export const DEMO_GOAL = EXERCISES.elbow_flexion.targetDeg

export interface DemoSession {
  week: string
  session: number
  best: number
  mean: number
}

/** Six weeks of demo elbow flexion, two sessions a week: best rep 111° to 129°, the mean four degrees behind. */
export const DEMO_SESSIONS: DemoSession[] = [111, 113, 114, 117, 118, 120, 121, 123, 125, 126, 128, 129].map((best, i) => ({
  week: `W${Math.floor(i / 2) + 1}`,
  session: (i % 2) + 1,
  best,
  mean: best - 4,
}))

const FIRST = DEMO_SESSIONS[0]!
const LAST = DEMO_SESSIONS[DEMO_SESSIONS.length - 1]!
const tick = { fill: 'var(--chart-axis)', fontSize: 11, fontFamily: 'var(--font-mono)' }
const axisRule = { stroke: 'var(--rule-strong)', strokeWidth: 1 }

/** Square cobalt markers with a paper ring; the endpoint also carries its value. */
function SquareDot({ cx, cy, index }: { cx?: number | string; cy?: number | string; index?: number }) {
  if (cx == null || cy == null) return null
  const x = Number(cx)
  const y = Number(cy)
  const last = index === DEMO_SESSIONS.length - 1
  return (
    <g key={`dot-${index}`}>
      <rect x={x - 4} y={y - 4} width={8} height={8} fill="var(--chart-data)" stroke="var(--paper)" strokeWidth={2} />
      {last && (
        <text x={x + 12} y={y + 4} fontFamily="var(--font-mono)" fontSize={11.5} fontWeight={500} fill="var(--ink-2)">
          {LAST.best}°
        </text>
      )}
    </g>
  )
}

function ActiveSquare({ cx, cy }: { cx?: number | string; cy?: number | string }) {
  if (cx == null || cy == null) return null
  const x = Number(cx)
  const y = Number(cy)
  return <rect x={x - 6} y={y - 6} width={12} height={12} fill="var(--chart-data)" stroke="var(--paper)" strokeWidth={2} />
}

/** The goal as a mono tag hanging off the right end of the navy rule. */
function GoalTag({ viewBox }: { viewBox?: { x?: number; y?: number; width?: number; height?: number } }) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) + 8
  const y = viewBox?.y ?? 0
  return (
    <g>
      <rect x={x} y={y - 9} width={62} height={18} fill="var(--paper)" stroke="var(--rule-strong)" strokeWidth={1} />
      <text x={x + 31} y={y + 3.5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fontWeight={500} letterSpacing="0.1em" fill="var(--navy)">
        GOAL {DEMO_GOAL}°
      </text>
    </g>
  )
}

function ChartTip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as DemoSession | undefined
  if (!active || !d) return null
  return (
    <div className="border border-navy-2 bg-navy px-3 py-2 font-mono text-[11.5px] leading-[1.6] text-white">
      <div className="text-[10.5px] tracking-[0.1em] text-rail-muted uppercase">
        {d.week} · session {d.session}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 tabular-nums">
        <span className="text-rail-muted">Best</span>
        <span className="font-medium">{d.best}°</span>
      </div>
      <div className="flex items-baseline justify-between gap-4 tabular-nums">
        <span className="text-rail-muted">Mean</span>
        <span>{d.mean}°</span>
      </div>
    </div>
  )
}

/**
 * The landing's one chart: best rep per demo session as a cobalt line with square markers, the
 * session mean as a navy dashed line, and the goal as a navy rule with a mono tag. No card
 * chrome; the y axis is drawn as a ruler. The best line draws in once when the strip scrolls
 * into view (instantly under reduced motion). A mono legend, a caption and a table view sit
 * under it so nothing depends on colour or hover.
 */
export function ReadoutChart() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const show = reduce || inView || typeof IntersectionObserver === 'undefined'

  return (
    <figure ref={ref} className="m-0">
      <div className="h-[220px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DEMO_SESSIONS} margin={{ top: 16, right: 84, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="week" interval={1} tick={tick} tickLine={axisRule} axisLine={axisRule} tickMargin={8} />
            <YAxis domain={[100, 150]} ticks={[100, 120, 140]} tickFormatter={(v: number) => `${v}°`} tick={tick} tickLine={axisRule} axisLine={axisRule} width={44} tickMargin={6} />
            <Tooltip content={ChartTip} cursor={{ stroke: 'var(--navy)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={DEMO_GOAL} stroke="var(--chart-goal)" strokeWidth={1} label={GoalTag} />
            <Line type="linear" dataKey="mean" name="Session mean" stroke="var(--chart-data-2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
            {show && <Line type="linear" dataKey="best" name="Best rep" stroke="var(--chart-data)" strokeWidth={2} dot={SquareDot} activeDot={ActiveSquare} isAnimationActive={!reduce} animationDuration={800} animationEasing="ease-out" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="t-meta mt-4 flex flex-wrap gap-x-6 gap-y-2" aria-label="Legend">
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" stroke="var(--chart-data)" strokeWidth="2" />
            <rect x="7" y="0" width="8" height="8" fill="var(--chart-data)" />
          </svg>
          Best rep
        </li>
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" stroke="var(--chart-data-2)" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>
          Session mean
        </li>
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" stroke="var(--chart-goal)" strokeWidth="1" />
          </svg>
          Goal {DEMO_GOAL}°
        </li>
      </ul>

      <figcaption className="t-mono mt-4 max-w-[64ch]">
        Best {EXERCISES.elbow_flexion.name.toLowerCase()} per session over six demo weeks, two sessions a week: {FIRST.best}° in the first session, {LAST.best}° in the last, against a {DEMO_GOAL}° goal. Demo
        data, not a promise.
      </figcaption>

      <details className="group mt-5 border-t border-rule">
        <summary className="t-meta flex cursor-pointer list-none items-center gap-3 py-3 text-ink-2 [&::-webkit-details-marker]:hidden">
          <span className="w-3 font-mono text-[14px] leading-none text-navy" aria-hidden="true">
            <span className="group-open:hidden">+</span>
            <span className="hidden group-open:inline">−</span>
          </span>
          Table view · {DEMO_SESSIONS.length} sessions
        </summary>
        <table className="ledger mb-2">
          <thead>
            <tr>
              <th scope="col">Session</th>
              <th scope="col">Week</th>
              <th scope="col" className="num">
                Best
              </th>
              <th scope="col" className="num">
                Mean
              </th>
            </tr>
          </thead>
          <tbody>
            {DEMO_SESSIONS.map((s, i) => (
              <tr key={`${s.week}-${s.session}`}>
                <td className="font-mono text-[12.5px] tabular-nums">{String(i + 1).padStart(2, '0')}</td>
                <td className="font-mono text-[12.5px]">
                  {s.week} · {s.session}
                </td>
                <td className="num">{s.best}°</td>
                <td className="num">{s.mean}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
