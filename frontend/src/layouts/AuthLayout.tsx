import { motion, useReducedMotion } from 'motion/react'
import { Link, Outlet } from 'react-router-dom'
import { APP_NAME } from '../brand'
import { IconArrowLeft, IconShield, IconTarget, IconUsers, Logo } from '../components/icons'
import { LiveArc } from '../components/landing/LiveArc'
import { ease } from '../components/motion'

const POINTS = [
  { icon: IconTarget, text: 'Goals in degrees, drawn on every chart' },
  { icon: IconUsers, text: 'One account, a profile for everyone at home' },
  { icon: IconShield, text: 'Private by default. No clinic, no sharing' },
]

/** Account pages: navy brand panel with the living arc on the left, the form on the right. */
export function AuthLayout() {
  const reduce = useReducedMotion()
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease, delay } })
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="on-navy relative flex flex-col overflow-hidden bg-navy px-6 py-6 text-white sm:px-10 lg:px-14 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-sky opacity-20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -bottom-40 h-[460px] w-[460px] rounded-full bg-primary opacity-30 blur-3xl" />
        <div aria-hidden="true" className="grid-lines pointer-events-none absolute inset-0" />

        <div className="relative flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.02em] text-white no-underline hover:no-underline">
            <Logo size={34} tone="white" />
            <span>{APP_NAME}</span>
          </Link>
          <Link to="/" className="btn btn-sm border-white/20 bg-white/5 text-white hover:border-white/50 hover:bg-white/10 hover:text-white">
            <IconArrowLeft size={15} /> Back
          </Link>
        </div>

        <div className="relative my-auto py-8 lg:py-14">
          <motion.div {...rise(0.05)} className="eyebrow text-sky">
            Range of motion AI
          </motion.div>
          <motion.h2 {...rise(0.12)} className="mt-3 max-w-[14ch] text-[clamp(2rem,3.6vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-white">
            Train. Measure. Watch the arc grow.
          </motion.h2>
          <motion.p {...rise(0.2)} className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-white/75">
            A camera app measures every rep in degrees. Arc is where you watch the trend, for everyone in the household.
          </motion.p>
          <motion.div {...rise(0.3)} className="mt-8 hidden max-w-[560px] lg:block">
            <LiveArc compact />
          </motion.div>
          <motion.ul {...rise(0.4)} className="mt-8 hidden gap-3 sm:grid">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14.5px] font-semibold text-white/85">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-sky">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </motion.ul>
        </div>

        <div className="relative hidden text-[12px] font-semibold text-white/45 sm:block">getarc.health</div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16 lg:py-12">
        <motion.div {...rise(0.15)} className="w-full max-w-[440px]">
          <Outlet />
        </motion.div>
      </section>
    </div>
  )
}
