import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '../brand'
import { IconCamera, IconChart, IconSparkle, IconUsers, Logo } from '../components/icons'
import { Blobs } from '../components/landing/Blobs'
import { Headline } from '../components/landing/Headline'
import { LiveArc } from '../components/landing/LiveArc'
import { Marquee } from '../components/landing/Marquee'
import { ease } from '../components/motion'

const MARQUEE = ['Elbow flexion', 'Shoulder abduction', 'Seated knee extension', 'Degrees, not guesses', 'Goal lines', 'Rep-by-rep detail', 'Fatigue proxy', 'Weekly consistency', 'Household profiles', 'Private by default']

const STEPS: [string, string][] = [
  ['Create an account', 'One per household. Add a profile for each person who exercises.'],
  ['Exercise on camera', 'The camera app measures every rep in degrees, counts sets and times rest.'],
  ['Watch the trend', 'Peak range against your goal, rep-by-rep detail, fatigue proxy, weekly consistency.'],
]

const FEATURES = [
  { icon: IconChart, title: 'Goal lines you can see', text: 'Set a goal angle per exercise. Every chart draws it, so progress is a distance, not a feeling.' },
  { icon: IconCamera, title: 'Every rep, in degrees', text: 'Peak range per rep, set by set. The server recomputes the numbers from raw reps; nothing is estimated twice.' },
  { icon: IconSparkle, title: 'Fatigue proxy', text: 'When range or tempo fades late in a set, Arc flags it. Honest labels: ROM decay and tempo drift, not a diagnosis.' },
  { icon: IconUsers, title: 'Built for the household', text: 'Profiles for everyone at home, any age, under one account. Switch who you are looking at in one click.' },
]

const STATS: [string, string][] = [
  ['+18°', 'elbow flexion in six weeks'],
  ['3×/week', 'sessions that stick'],
  ['0 guesses', 'every rep in degrees'],
]

const section: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
const item: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } } }

export function LandingPage() {
  const reduce = useReducedMotion()
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease, delay } })
  const reveal = { variants: section, initial: reduce ? 'show' : 'hidden', whileInView: 'show', viewport: { once: true, margin: '-80px' } } as const

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ---------- Nav ---------- */}
      <motion.header {...rise(0)} className="relative z-10 mx-auto flex max-w-[1200px] items-center gap-3 px-6 py-5 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5 text-[19px] font-extrabold tracking-tight text-ink no-underline hover:no-underline">
          <Logo size={34} />
          <span>{APP_NAME}</span>
        </Link>
        <span className="hidden rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase backdrop-blur sm:inline">Range of motion AI</span>
        <span className="flex-1" />
        <Link to="/login" className="btn btn-ghost">
          Log in
        </Link>
        <Link to="/signup" className="btn btn-primary">
          Get started
        </Link>
      </motion.header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <Blobs />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 pt-8 pb-16 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-14 lg:pb-24">
          <div>
            <Headline />
            <motion.p {...rise(0.5)} className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-ink-2">
              A camera app measures every rep in degrees, like a goniometer that lives in your laptop. Arc is where you watch the trend: peak range, fading range within a set, and
              how consistently you show up. For anyone in the household, at any age.
            </motion.p>
            <motion.div {...rise(0.65)} className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="btn btn-primary px-5 py-3 text-[15px]">
                Create your account
              </Link>
              <Link to="/login" className="btn px-5 py-3 text-[15px]">
                Log in
              </Link>
            </motion.div>
            <motion.p {...rise(0.75)} className="mt-3 text-[13px] text-muted">
              Free for the household. No camera needed to explore: load the demo profile.
            </motion.p>
            <motion.dl initial={reduce ? 'show' : 'hidden'} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 1.0 } } }} className="mt-8 flex flex-wrap gap-6">
              {STATS.map(([value, label]) => (
                <motion.div key={label} variants={{ hidden: { opacity: 0, y: 10, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } } }}>
                  <dt className="text-[12px] text-muted">{label}</dt>
                  <dd className="text-[22px] leading-tight font-bold tracking-tight text-ink tabular-nums">{value}</dd>
                </motion.div>
              ))}
            </motion.dl>
          </div>
          <motion.div {...rise(0.7)} className="relative">
            <LiveArc />
          </motion.div>
        </div>
        <motion.div {...rise(0.9)} className="relative pb-6">
          <Marquee items={MARQUEE} />
        </motion.div>
      </section>

      {/* ---------- How it works ---------- */}
      <motion.section {...reveal} className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10">
        <motion.div variants={item} className="mb-8">
          <div className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">How it works</div>
          <h2 className="text-[1.8rem] font-bold tracking-tight text-ink">Three steps, then it runs itself</h2>
        </motion.div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <motion.li key={t} variants={item} whileHover={reduce ? undefined : { y: -4 }} className="card transition-shadow hover:shadow-pop">
              <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">{i + 1}</div>
              <div className="text-[16px] font-semibold text-ink">{t}</div>
              <div className="mt-1.5 text-[14px] text-muted">{d}</div>
            </motion.li>
          ))}
        </ol>
      </motion.section>

      {/* ---------- Features ---------- */}
      <motion.section {...reveal} className="relative overflow-hidden border-y border-line bg-surface/60 py-16">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <motion.div variants={item} className="mb-8 max-w-[60ch]">
            <div className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">What you get</div>
            <h2 className="text-[1.8rem] font-bold tracking-tight text-ink">Numbers worth coming back to</h2>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <motion.div key={title} variants={item} whileHover={reduce ? undefined : { y: -4 }} className="card flex gap-4 transition-shadow hover:shadow-pop">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon width={20} height={20} />
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-ink">{title}</div>
                  <div className="mt-1.5 text-[14px] text-muted">{text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ---------- Call to action ---------- */}
      <motion.section {...reveal} className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10">
        <motion.div variants={item} className="relative overflow-hidden rounded-3xl bg-brand px-8 py-12 text-white shadow-pop sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
          <h2 className="max-w-[18ch] text-[1.9rem] leading-tight font-bold tracking-tight">Start the first week today.</h2>
          <p className="mt-3 max-w-[48ch] text-[15px] text-white/85">Create the household account, add a profile, and load the demo data to see what six weeks of progress looks like before your first real session.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup" className="btn bg-white px-5 py-3 text-[15px] text-primary hover:bg-white/90">
              Create your account
            </Link>
            <Link to="/login" className="btn border-white/40 bg-transparent px-5 py-3 text-[15px] text-white hover:bg-white/10">
              Log in
            </Link>
          </div>
        </motion.div>
      </motion.section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-6 py-8 text-[13px] text-muted sm:px-10">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <Logo size={20} /> {APP_NAME}
        </span>
        <span>Range of motion, measured at home. A personal tool, not a clinical one.</span>
        <span className="flex-1" />
        <Link to="/login">Log in</Link>
        <Link to="/signup">Sign up</Link>
      </footer>
    </div>
  )
}
