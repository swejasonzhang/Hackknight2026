import { motion, useReducedMotion } from 'motion/react'
import { ease } from '../motion'

/** A small line that draws itself when it scrolls into view; the last point carries its value. */
export function Sparkline({ values, goal, className = '', label }: { values: number[]; goal?: number; className?: string; label: string }) {
  const reduce = useReducedMotion()
  const W = 240
  const H = 64
  const lo = Math.min(...values, goal ?? Infinity) - 4
  const hi = Math.max(...values, goal ?? -Infinity) + 4
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (W - 8) + 4
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const lastX = x(values.length - 1)
  const lastY = y(values.at(-1) ?? 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label}>
      {goal != null && <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="3 3" />}
      <motion.path d={d} fill="none" stroke="currentColor" strokeWidth="2" initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease }} />
      <motion.rect x={lastX - 3.5} y={lastY - 3.5} width="7" height="7" fill="currentColor" initial={reduce ? false : { scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.3, duration: 0.3, ease }} />
    </svg>
  )
}
