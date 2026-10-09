import { motion, useReducedMotion } from 'motion/react'
import { Outlet } from 'react-router-dom'
import { APP_NAME } from '../brand'
import { Logo } from '../components/icons'
import { AnimatedNumber, ease, Float } from '../components/motion'

const cx = 160
const cy = 172
const r = 128
const pt = (deg: number, radius: number) => {
  const a = Math.PI - (deg * Math.PI) / 180
  return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) }
}

/** A goniometer arc that draws itself to 132° against a 140° goal. */
function HeroArc() {
  const reduce = useReducedMotion()
  const ticks = [0, 30, 60, 90, 120, 150, 180]
  const start = pt(0, r)
  const marker = pt(132, r)
  const end = pt(180, r)
  const track = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`
  const sweep = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${marker.x} ${marker.y}`
  const g1 = pt(140, r + 2)
  const g2 = pt(140, r - 22)
  return (
    <svg className="h-auto w-full max-w-[400px]" viewBox="0 0 320 200" role="img" aria-label="Arc showing 132 degrees of range of motion against a 140 degree goal">
      <path d={track} fill="none" stroke="var(--line-strong)" strokeWidth="10" strokeLinecap="round" />
      <motion.path d={sweep} fill="none" stroke="url(#arcGrad)" strokeWidth="10" strokeLinecap="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease, delay: 0.2 }} />
      <defs>
        <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary-2)" />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const a = pt(t, r + 20)
        return (
          <text key={t} x={a.x} y={a.y + 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {t}°
          </text>
        )
      })}
      <line x1={g1.x} y1={g1.y} x2={g2.x} y2={g2.y} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <motion.circle cx={marker.x} cy={marker.y} r="9" fill="var(--surface)" stroke="var(--primary-2)" strokeWidth="4" initial={reduce ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.5, duration: 0.3 }} style={{ transformOrigin: `${marker.x}px ${marker.y}px` }} />
      <text x={cx} y={cy - 26} textAnchor="middle" fontSize="42" fontWeight="800" fill="var(--ink)" letterSpacing="-1">
        <AnimatedNumber value={132} suffix="°" duration={1.5} />
      </text>
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fill="var(--muted)">
        elbow flexion · goal 140°
      </text>
    </svg>
  )
}

function Proof({ value, label, className = '', delay = 0 }: { value: string; label: string; className?: string; delay?: number }) {
  return (
    <Float className={`absolute ${className}`} delay={delay}>
      <div className="rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-pop backdrop-blur">
        <div className="text-[20px] leading-none font-bold tracking-tight text-ink tabular-nums">{value}</div>
        <div className="mt-1 text-[12px] text-muted">{label}</div>
      </div>
    </Float>
  )
}

/** Front door for visitors: the pitch on the left, the sign-up or login card on the right. */
export function AuthLayout() {
  const reduce = useReducedMotion()
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease, delay } })
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)]">
      <section className="relative overflow-hidden px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary opacity-[0.08] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -bottom-40 h-[460px] w-[460px] rounded-full bg-accent opacity-[0.10] blur-3xl" />

        <motion.div {...rise(0)} className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-tight text-ink">
          <Logo size={36} />
          <span>{APP_NAME}</span>
        </motion.div>

        <motion.h1 {...rise(0.08)} className="mt-10 max-w-[13ch] text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-ink">
          See your <span className="text-gradient">range of motion</span> improve, week by week.
        </motion.h1>

        <motion.p {...rise(0.16)} className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-ink-2">
          A camera app measures every rep in degrees, like a goniometer that lives in your laptop. Arc is where you watch the trend: peak range, fading range within a set, and how
          consistently you show up. For anyone in the household, at any age.
        </motion.p>

        <motion.div {...rise(0.24)} className="relative mt-10 max-w-[560px]">
          <HeroArc />
          <Proof value="+18°" label="elbow flexion in 6 weeks" className="top-2 right-0 hidden sm:block" delay={0} />
          <Proof value="3×/wk" label="sessions, every week" className="right-0 bottom-0 hidden sm:block" delay={1.6} />
        </motion.div>

        <motion.ol {...rise(0.32)} className="mt-10 grid max-w-[640px] gap-3 sm:grid-cols-3">
          {[
            ['Create an account', 'Add a profile for each person who exercises.'],
            ['Exercise on camera', 'The camera app counts reps and sets and stores the session.'],
            ['Watch the trend', 'Goal lines, rep-by-rep detail, fatigue proxy, weekly consistency.'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur">
              <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">{i + 1}</div>
              <div className="text-[14px] font-semibold text-ink">{t}</div>
              <div className="mt-1 text-[13px] text-muted">{d}</div>
            </li>
          ))}
        </motion.ol>
      </section>

      <section className="flex items-center justify-center border-t border-line bg-surface px-6 py-10 lg:border-t-0 lg:border-l lg:px-10">
        <motion.div {...rise(0.12)} className="w-full max-w-[400px]">
          <Outlet />
        </motion.div>
      </section>
    </div>
  )
}
