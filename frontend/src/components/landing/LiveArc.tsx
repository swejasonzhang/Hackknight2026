import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useState } from 'react'
import { createRepCycle } from './repCycle'

const cx = 160
const cy = 172
const r = 128
const REST = 18
const GOAL = 140
/** Six reps per loop; the last ones shrink so the nudge has something to say. */
const PEAKS = [131, 128, 134, 125, 129, 122]
const SECONDS_PER_REP = 2.4

const pt = (deg: number, radius: number) => {
  const a = Math.PI - (deg * Math.PI) / 180
  return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) }
}

const start = pt(0, r)
const end = pt(180, r)
const track = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`
const g1 = pt(GOAL, r + 2)
const g2 = pt(GOAL, r - 22)
const TICKS = [0, 30, 60, 90, 120, 150, 180]

/**
 * The hero: an arc that performs reps on a loop, the readout tracking the angle, and a
 * live-set card that counts reps, draws each peak and nudges when the range shrinks.
 */
export function LiveArc() {
  const reduce = useReducedMotion()
  const angle = useMotionValue(reduce ? 132 : REST)
  const [peaks, setPeaks] = useState<number[]>(reduce ? PEAKS : [])
  const [cycle] = useState(() => createRepCycle({ top: 115, bottom: 35 }))

  useEffect(() => {
    if (reduce) return
    const frames = [REST, ...PEAKS.flatMap((p) => [p, REST])]
    const controls = animate(angle, frames, { duration: PEAKS.length * SECONDS_PER_REP, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.4 })
    return () => controls.stop()
  }, [angle, reduce])

  useMotionValueEvent(angle, 'change', (v) => {
    const e = cycle.feed(v)
    if (e.completed && e.peak != null) {
      const peak = e.peak
      setPeaks((prev) => (prev.length >= PEAKS.length ? [peak] : [...prev, peak]))
    }
  })

  const progress = useTransform(angle, (v) => v / 180)
  const mx = useTransform(angle, (v) => pt(v, r).x)
  const my = useTransform(angle, (v) => pt(v, r).y)
  const label = useTransform(angle, (v) => `${Math.round(v)}°`)

  const last = peaks.at(-1)
  const nudge = last == null ? null : last < 127 ? { text: 'Range shrinking late in the set', tone: 'warn' as const } : { text: 'Full range', tone: 'good' as const }

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_200px]">
      <svg className="h-auto w-full max-w-[400px]" viewBox="0 0 320 200" role="img" aria-label={`Arc performing reps toward a ${GOAL} degree goal`}>
        <defs>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--primary-2)" />
          </linearGradient>
        </defs>
        <path d={track} fill="none" stroke="var(--line-strong)" strokeWidth="10" strokeLinecap="round" />
        <motion.path d={track} fill="none" stroke="url(#arcGrad)" strokeWidth="10" strokeLinecap="round" style={{ pathLength: progress }} />
        {TICKS.map((t) => {
          const a = pt(t, r + 20)
          return (
            <text key={t} x={a.x} y={a.y + 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {t}°
            </text>
          )
        })}
        <line x1={g1.x} y1={g1.y} x2={g2.x} y2={g2.y} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        <motion.circle cx={mx} cy={my} r="9" fill="var(--surface)" stroke="var(--primary-2)" strokeWidth="4" />
        <motion.text x={cx} y={cy - 26} textAnchor="middle" fontSize="42" fontWeight="800" fill="var(--ink)" letterSpacing="-1">
          {label}
        </motion.text>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fill="var(--muted)">
          elbow flexion · goal {GOAL}°
        </text>
      </svg>

      <div className="rounded-sm border border-line bg-surface/90 p-4 shadow-pop backdrop-blur">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[12px] font-bold tracking-[0.16em] text-muted uppercase">Live set</span>
          <span className="font-display text-[15px] font-bold tracking-wide text-ink uppercase tabular-nums">
            Rep {peaks.length} <span className="text-muted">/ {PEAKS.length}</span>
          </span>
        </div>
        <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden="true">
          {PEAKS.map((_, i) => {
            const p = peaks[i]
            const height = p == null ? 0 : Math.max(8, ((p - 100) / 40) * 100)
            return (
              <div key={i} className="flex h-full flex-1 items-end rounded-sm bg-surface-2">
                {p != null && (
                  <motion.div
                    className={`w-full rounded-sm ${p < 127 ? 'bg-primary-2' : 'bg-accent'}`}
                    initial={reduce ? false : { height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  />
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 h-5 text-[12px] font-semibold">
          {nudge && (
            <motion.span key={peaks.length} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`font-display tracking-[0.08em] uppercase ${nudge.tone === 'warn' ? 'text-primary-2' : 'text-accent'}`}>
              {nudge.text}
            </motion.span>
          )}
        </div>
      </div>
    </div>
  )
}
