import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { APP_NAME } from '../brand'
import { IconActivity, IconArrowRight, IconCamera, IconFlame, IconTarget, IconUsers, Logo } from '../components/icons'
import { Blobs } from '../components/landing/Blobs'
import { Headline } from '../components/landing/Headline'
import { LiveArc } from '../components/landing/LiveArc'
import { Marquee } from '../components/landing/Marquee'
import { AnimatedNumber, ease, Float, Item, Lift, Reveal } from '../components/motion'

const MARQUEE = ['Elbow flexion', 'Shoulder abduction', 'Seated knee extension', 'Degrees, not guesses', 'Goal lines', 'Rep-by-rep detail', 'Fatigue proxy', 'Weekly consistency', 'Household profiles', 'Private by default']

const STATS: [number, string, string][] = [
  [18, '°', 'elbow flexion gained in six weeks'],
  [3, '×/wk', 'sessions that actually stick'],
  [0, '', 'guesses: every rep in degrees'],
]

const STEPS = [
  { icon: IconUsers, title: 'Create an account', text: 'One per household. Add a profile for each person who exercises.' },
  { icon: IconCamera, title: 'Exercise on camera', text: 'The camera app measures every rep in degrees, counts sets and times rest.' },
  { icon: IconActivity, title: 'Watch the trend', text: 'Peak range against your goal, rep-by-rep detail, fatigue proxy, weekly consistency.' },
]

const FEATURES = [
  { icon: IconTarget, title: 'Goal lines you can see', text: 'Set a goal angle per exercise. Every chart draws it, so progress is a distance, not a feeling.' },
  { icon: IconCamera, title: 'Every rep, in degrees', text: 'Peak range per rep, set by set. The server recomputes the numbers from raw reps; nothing is estimated twice.' },
  { icon: IconFlame, title: 'Fatigue proxy', text: 'When range or tempo fades late in a set, Arc flags it. Honest labels: ROM decay and tempo drift, not a diagnosis.' },
  { icon: IconUsers, title: 'Built for the household', text: 'Profiles for everyone at home, any age, under one account. Switch who you are looking at in one click.' },
]

/** Six weeks of demo progress for the showcase chart. */
const DEMO = [111, 113, 114, 117, 118, 120, 121, 123, 125, 126, 128, 129].map((best, i) => ({ week: `W${Math.floor(i / 2) + 1}`, best, mean: best - 4 }))

const item: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }

export function LandingPage() {
  const reduce = useReducedMotion()
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, ease, delay } })

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ---------- Nav ---------- */}
      <motion.header {...rise(0)} className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-6 py-4 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.02em] text-ink no-underline hover:no-underline">
            <Logo size={34} />
            <span>{APP_NAME}</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-[14px] font-bold text-ink-2 md:flex" aria-label="Sections">
            <a href="#how" className="text-ink-2 no-underline hover:text-primary">
              How it works
            </a>
            <a href="#features" className="text-ink-2 no-underline hover:text-primary">
              Features
            </a>
            <a href="#progress" className="text-ink-2 no-underline hover:text-primary">
              Progress
            </a>
          </nav>
          <span className="flex-1" />
          <Link to="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link to="/signup" className="btn btn-primary">
            Get started <IconArrowRight size={16} />
          </Link>
        </div>
      </motion.header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <Blobs />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 pt-12 pb-16 sm:px-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pt-20 lg:pb-24">
          <div>
            <motion.div {...rise(0.05)} className="eyebrow">
              Range of motion AI · for the whole household
            </motion.div>
            <Headline />
            <motion.p {...rise(0.5)} className="lead mt-6 max-w-[50ch]">
              A camera app measures every rep in degrees, like a goniometer that lives in your laptop. Arc is where you watch the trend: peak range, fading range within a set, and how
              consistently you show up. Any age. No clinic.
            </motion.p>
            <motion.div {...rise(0.62)} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="btn btn-primary btn-lg">
                Create your account <IconArrowRight size={17} />
              </Link>
              <Link to="/login" className="btn btn-lg">
                Log in
              </Link>
            </motion.div>
            <motion.p {...rise(0.7)} className="mt-3 text-[13px] font-semibold text-muted">
              Free for the household. No camera needed to explore: load the demo profile.
            </motion.p>
            <motion.dl initial={reduce ? 'show' : 'hidden'} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.9 } } }} className="mt-10 grid max-w-[560px] grid-cols-3 gap-4 border-t border-line pt-6">
              {STATS.map(([value, suffix, label]) => (
                <motion.div key={label} variants={item}>
                  <dd className="text-[30px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">
                    {value > 0 && suffix === '°' ? '+' : ''}
                    <AnimatedNumber value={value} suffix={suffix} duration={1.2} />
                  </dd>
                  <dt className="mt-1.5 text-[12.5px] font-semibold text-muted">{label}</dt>
                </motion.div>
              ))}
            </motion.dl>
          </div>

          <motion.div {...rise(0.45)} className="relative">
            <div className="on-navy relative overflow-hidden rounded-[28px] bg-navy p-6 text-white shadow-pop sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky opacity-30 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-primary opacity-40 blur-3xl" />
              <div className="relative mb-5 flex items-center justify-between">
                <span className="text-[12px] font-bold tracking-[0.12em] text-white/60 uppercase">Live measurement</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-sky">camera app</span>
              </div>
              <div className="relative">
                <LiveArc />
              </div>
            </div>
            <Float className="absolute -bottom-6 -left-4 hidden xl:block" delay={0.6}>
              <div className="rounded-[16px] border border-line bg-surface px-4 py-3 shadow-pop">
                <div className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">This week</div>
                <div className="mt-1 text-[20px] leading-none font-extrabold text-ink tabular-nums">
                  3 sessions <span className="text-[13px] font-bold text-good">+2° best</span>
                </div>
              </div>
            </Float>
          </motion.div>
        </div>

        <div className="on-navy relative bg-navy text-white">
          <Marquee items={MARQUEE} />
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <Reveal className="mx-auto max-w-[1200px] px-6 py-20 sm:px-10">
        <div id="how" className="mb-10 scroll-mt-24 flex flex-wrap items-end justify-between gap-6">
          <Item>
            <div className="eyebrow mb-2">How it works</div>
            <h2 className="max-w-[18ch]">Three steps, then it runs itself</h2>
          </Item>
          <Item>
            <Link to="/signup" className="btn btn-navy">
              Start now <IconArrowRight size={16} />
            </Link>
          </Item>
        </div>
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Item key={title}>
              <Lift className="card h-full">
                <div className="mb-6 flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
                    <Icon size={20} />
                  </span>
                  <span className="text-[44px] leading-none font-extrabold tracking-[-0.04em] text-line-strong">0{i + 1}</span>
                </div>
                <h3 className="text-[19px]">{title}</h3>
                <p className="mt-2 text-[14.5px] text-muted">{text}</p>
              </Lift>
            </Item>
          ))}
        </ol>
      </Reveal>

      {/* ---------- Progress showcase ---------- */}
      <section id="progress" className="scroll-mt-16 bg-surface-2/60 py-20">
        <Reveal className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Item>
            <div className="eyebrow mb-2">Progress you can see</div>
            <h2 className="max-w-[16ch]">Six weeks, one line, no guesswork</h2>
            <p className="lead mt-5 max-w-[46ch]">
              Every session lands as a point. Your goal is a line. The gap between them is the only number that matters, and Arc shows it shrinking.
            </p>
            <ul className="mt-6 grid gap-3 text-[14.5px] font-semibold text-ink-2">
              {['Best and mean rep per session', 'Goal line per exercise', 'Fatigue proxy and weekly consistency', 'Every session, set by set'].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-primary" /> {t}
                </li>
              ))}
            </ul>
          </Item>
          <Item>
            <Lift className="card p-5 sm:p-7">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Elbow flexion · best rep</div>
                  <div className="mt-1 text-[32px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">
                    <AnimatedNumber value={129} suffix="°" duration={1.4} /> <span className="text-[14px] font-bold text-good">+18° since week 1</span>
                  </div>
                </div>
                <span className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-bold text-primary">goal 140°</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={DEMO} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="week" interval={1} tick={{ fill: 'var(--chart-axis)', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[90, 150]} unit="°" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13 }} formatter={(v) => `${Number(v)}°`} />
                  <ReferenceLine y={140} stroke="var(--chart-goal)" strokeDasharray="6 3" />
                  <Line type="monotone" dataKey="best" name="Best rep" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3.5, strokeWidth: 0, fill: 'var(--chart-1)' }} isAnimationActive={!reduce} />
                  <Line type="monotone" dataKey="mean" name="Mean rep" stroke="var(--chart-1-soft)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={!reduce} />
                </LineChart>
              </ResponsiveContainer>
            </Lift>
          </Item>
        </Reveal>
      </section>

      {/* ---------- Features ---------- */}
      <Reveal className="mx-auto max-w-[1200px] px-6 py-20 sm:px-10">
        <Item>
          <div id="features" className="mb-10 max-w-[60ch] scroll-mt-24">
            <div className="eyebrow mb-2">What you get</div>
            <h2>Numbers worth coming back to</h2>
          </div>
        </Item>
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Item key={title}>
              <Lift className="card flex h-full gap-5">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-navy text-sky">
                  <Icon size={22} />
                </span>
                <div>
                  <h3 className="text-[18px]">{title}</h3>
                  <p className="mt-2 text-[14.5px] text-muted">{text}</p>
                </div>
              </Lift>
            </Item>
          ))}
        </div>
      </Reveal>

      {/* ---------- Call to action ---------- */}
      <Reveal className="mx-auto max-w-[1200px] px-6 pb-20 sm:px-10">
        <Item>
          <div className="on-navy relative overflow-hidden rounded-[28px] bg-navy px-8 py-14 text-white shadow-pop sm:px-14">
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full bg-sky opacity-30 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-primary opacity-40 blur-3xl" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h2 className="max-w-[18ch] text-white">Start the first week today.</h2>
                <p className="mt-3 max-w-[48ch] text-[16px] text-white/75">Create the household account, add a profile, and load the demo data to see what six weeks of progress looks like before your first real session.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/signup" className="btn btn-lg border-white bg-white text-navy hover:border-white hover:bg-sky hover:text-navy">
                  Create your account
                </Link>
                <Link to="/login" className="btn btn-lg border-white/30 bg-white/5 text-white hover:border-white hover:bg-white/10 hover:text-white">
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </Item>
      </Reveal>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-6 py-8 text-[13px] font-semibold text-muted sm:px-10">
          <span className="flex items-center gap-2 text-ink">
            <Logo size={22} /> {APP_NAME}
          </span>
          <span>Range of motion, measured at home. A personal tool, not a clinical one.</span>
          <span className="flex-1" />
          <Link to="/login">Log in</Link>
          <Link to="/signup">Sign up</Link>
        </div>
      </footer>
    </div>
  )
}
