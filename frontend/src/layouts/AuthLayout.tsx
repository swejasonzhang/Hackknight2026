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

/** Account pages: a glowing headline and the living arc on the left, the form in a glowing card on the right. */
export function AuthLayout() {
  const reduce = useReducedMotion()
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease, delay } })
  return (
    <div className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div aria-hidden="true" className="glow-blue pointer-events-none absolute inset-x-0 top-0 h-[60vh]" />
      <div aria-hidden="true" className="grid-lines pointer-events-none absolute inset-0" />

      <section className="relative flex flex-col px-6 py-6 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-[20px] font-semibold tracking-[-0.02em] text-ink no-underline hover:no-underline">
            <Logo size={34} />
            <span>{APP_NAME}</span>
          </Link>
          <Link to="/" className="btn btn-sm">
            <IconArrowLeft size={15} /> Back
          </Link>
        </div>

        <div className="my-auto py-8 lg:py-14">
          <motion.div {...rise(0.05)} className="eyebrow">
            Range of motion AI
          </motion.div>
          <motion.h2 {...rise(0.12)} className="display-2 glow-text mt-4 max-w-[12ch]">
            Train. Measure. Watch the arc grow.
          </motion.h2>
          <motion.p {...rise(0.2)} className="lead mt-5 max-w-[44ch]">
            A camera app measures every rep in degrees. Arc is where you watch the trend, for everyone in the household.
          </motion.p>
          <motion.div {...rise(0.3)} className="card mt-8 hidden max-w-[560px] p-5 lg:block">
            <LiveArc compact />
          </motion.div>
          <motion.ul {...rise(0.4)} className="mt-8 hidden gap-3 sm:grid">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14.5px] font-medium text-ink-2">
                <span className="ring-icon h-9 w-9">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </motion.ul>
        </div>

        <div className="hidden text-[12px] font-medium text-muted sm:block">getarc.health</div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16 lg:py-12">
        <motion.div {...rise(0.15)} className="card w-full max-w-[460px] p-6 sm:p-8">
          <Outlet />
        </motion.div>
      </section>
    </div>
  )
}
