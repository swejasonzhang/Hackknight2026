import * as Accordion from '@radix-ui/react-accordion'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, type Variants } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { APP_NAME } from '../brand'
import { IconActivity, IconArrowRight, IconCamera, IconCheck, IconChevronDown, IconFlame, IconShield, IconTarget, IconTimer, IconUsers, Logo } from '../components/icons'
import { Blobs } from '../components/landing/Blobs'
import { Headline } from '../components/landing/Headline'
import { LiveArc } from '../components/landing/LiveArc'
import { Marquee } from '../components/landing/Marquee'
import { AnimatedNumber, ease, Item, Lift, Reveal } from '../components/motion'
import { Avatar } from '../components/ui'

const NAV = [
  ['#how', 'How it works'],
  ['#progress', 'Progress'],
  ['#features', 'Features'],
  ['#faq', 'FAQ'],
] as const

const MARQUEE = ['Elbow flexion', 'Shoulder abduction', 'Seated knee extension', 'Degrees, not guesses', 'Goal lines', 'Rep-by-rep detail', 'Fatigue proxy', 'Weekly consistency', 'Household profiles', 'Private by default']

const PROMISES = ['Free for the household', 'Demo profile included', 'Private by default']

const STATS: [number, string, string][] = [
  [18, '°', 'gained in six weeks'],
  [3, '×/wk', 'sessions that stick'],
  [0, '', 'guesses per rep'],
]

const STEPS = [
  { icon: IconUsers, title: 'Create the household account', text: 'One login for everyone at home. Add a profile per person, set a goal angle per exercise.' },
  { icon: IconCamera, title: 'Exercise in front of the camera', text: 'The camera app measures every rep in degrees, counts sets, and times your rest.' },
  { icon: IconActivity, title: 'Watch the arc grow', text: 'Peak range against the goal, rep-by-rep detail, a fatigue proxy and weekly consistency.' },
]

const CHECKS = ['Best and mean rep per session', 'A goal line on every chart', 'Fatigue proxy and weekly consistency', 'Every session, set by set']

const FAQ = [
  { q: 'What do I need?', a: 'A laptop or desktop with a webcam for the camera app. Arc itself runs in any browser, on any device, so you can check progress from your phone.' },
  { q: 'Who is it for?', a: 'Anyone at home who wants to see their range of motion improve, at any age. One account per household, a profile per person. It is a personal tool, not a clinical one.' },
  { q: 'Which movements does it measure?', a: 'Elbow flexion, shoulder abduction and seated knee extension today, on the left or right side, always in degrees.' },
  { q: 'Is my data private?', a: 'Your sessions belong to your account and nobody else sees them. The camera app writes to your account with its own key, and nothing is shared with a clinic.' },
]

/** Six weeks of demo progress, two sessions a week, +18° overall. */
const DEMO = [111, 113, 114, 117, 118, 120, 121, 123, 125, 126, 128, 129].map((best, i) => ({ week: `W${Math.floor(i / 2) + 1}`, best, mean: best - 4 }))

const item: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }

function GoalSketch() {
  return (
    <svg viewBox="0 0 320 120" className="h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id="sketchFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="26" x2="320" y2="26" stroke="var(--chart-goal)" strokeWidth="2" strokeDasharray="6 4" />
      <text x="312" y="18" textAnchor="end" fontSize="11" fontWeight="700" fill="var(--chart-goal)">
        goal 140°
      </text>
      <path d="M0 100 C 60 96, 90 88, 130 78 S 210 52, 250 44 S 300 34, 320 32 V 120 H 0 Z" fill="url(#sketchFill)" />
      <path d="M0 100 C 60 96, 90 88, 130 78 S 210 52, 250 44 S 300 34, 320 32" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
      {[
        [0, 100],
        [130, 78],
        [250, 44],
        [320, 32],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="4.5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="3" />
      ))}
    </svg>
  )
}

export function LandingPage() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8))
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, ease, delay } })

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ---------- Nav ---------- */}
      <motion.header {...rise(0)} className={`sticky top-0 z-30 border-b bg-canvas/85 backdrop-blur-md transition-[border-color,box-shadow] duration-300 ${scrolled ? 'border-line shadow-sm' : 'border-transparent'}`}>
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-3 px-6 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.02em] text-ink no-underline hover:no-underline">
            <Logo size={32} />
            <span>{APP_NAME}</span>
          </Link>
          <nav className="ml-8 hidden items-center gap-7 md:flex" aria-label="Sections">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="nav-link">
                {label}
              </a>
            ))}
          </nav>
          <span className="flex-1" />
          <Link to="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link to="/signup" className="btn btn-primary group">
            Get started <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </motion.header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <Blobs />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-14 px-6 pt-14 pb-16 sm:px-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-10 lg:pt-20 lg:pb-24">
          <div>
            <motion.div {...rise(0.05)} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-bold text-ink-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Range of motion AI <span className="text-muted">·</span> built for the household
            </motion.div>
            <Headline />
            <motion.p {...rise(0.5)} className="lead mt-6 max-w-[48ch]">
              A camera app measures every rep in degrees, like a goniometer that lives in your laptop. Arc turns those sessions into one honest trend: peak range, fading range within a set,
              and how often you show up.
            </motion.p>
            <motion.div {...rise(0.6)} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="btn btn-primary btn-lg group">
                Create your account <IconArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#how" className="btn btn-lg">
                See how it works
              </a>
            </motion.div>
            <motion.ul {...rise(0.68)} className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-ink-2">
              {PROMISES.map((p) => (
                <li key={p} className="flex items-center gap-1.5">
                  <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <IconCheck size={11} strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </motion.ul>
            <motion.dl initial={reduce ? 'show' : 'hidden'} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.85 } } }} className="mt-10 grid max-w-[560px] grid-cols-3 border-t border-line pt-6">
              {STATS.map(([value, suffix, label], i) => (
                <motion.div key={label} variants={item} className={i > 0 ? 'border-l border-line pl-5' : ''}>
                  <dd className="text-[32px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">
                    {value > 0 && suffix === '°' ? '+' : ''}
                    <AnimatedNumber value={value} suffix={suffix} duration={1.2} />
                  </dd>
                  <dt className="mt-1.5 text-[12.5px] font-semibold text-muted">{label}</dt>
                </motion.div>
              ))}
            </motion.dl>
          </div>

          <motion.div {...rise(0.4)} className="relative min-w-0 lg:justify-self-end">
            <div className="on-navy relative w-full max-w-[560px] overflow-hidden rounded-[24px] bg-navy p-2 text-white shadow-pop ring-1 ring-white/10">
              <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky opacity-25 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-primary opacity-35 blur-3xl" />
              <div className="relative flex items-center gap-2 px-3 py-2.5 text-[11.5px] font-bold text-white/55">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </span>
                <span className="ml-1 min-w-0 truncate tracking-[0.08em] uppercase">Arc camera · elbow flexion · right</span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] tracking-[0.1em] text-white uppercase">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bad" /> Live
                </span>
              </div>
              <div className="relative rounded-[18px] bg-white/[0.04] p-5 ring-1 ring-white/10 sm:p-6">
                <LiveArc />
              </div>
              <div className="relative grid grid-cols-3 gap-2 px-1 pt-2 pb-1 text-[12px] font-bold">
                {[
                  [IconActivity, 'Set', '2 / 3'],
                  [IconTimer, 'Rest', '45 s'],
                  [IconTarget, 'Goal', '140°'],
                ].map(([Icon, label, value]) => (
                  <div key={label as string} className="flex items-center gap-2 rounded-[12px] bg-white/[0.06] px-3 py-2 text-white/70">
                    <Icon size={14} className="shrink-0 text-sky" />
                    <span className="hidden sm:inline">{label as string}</span>
                    <span className="ml-auto whitespace-nowrap text-white tabular-nums">{value as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="on-navy relative bg-navy text-white">
          <Marquee items={MARQUEE} />
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <Reveal className="mx-auto max-w-[1200px] px-6 py-24 sm:px-10">
        <div id="how" className="mb-12 flex scroll-mt-24 flex-wrap items-end justify-between gap-6">
          <Item>
            <div className="eyebrow mb-3">How it works</div>
            <h2 className="max-w-[18ch]">Three steps, then it runs itself</h2>
          </Item>
          <Item>
            <Link to="/signup" className="btn btn-navy group">
              Start now <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Item>
        </div>
        <ol className="relative grid gap-5 md:grid-cols-3">
          <div aria-hidden="true" className="absolute top-[52px] right-[16%] left-[16%] hidden border-t-2 border-dashed border-line-strong md:block" />
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Item key={title}>
              <Lift className="card relative h-full border-line/80 hover:border-primary/40">
                <div className="relative mb-6 flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary text-white shadow-blue">
                    <Icon size={21} />
                  </span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Step {i + 1}</span>
                </div>
                <h3 className="text-[19px]">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{text}</p>
              </Lift>
            </Item>
          ))}
        </ol>
      </Reveal>

      {/* ---------- Progress showcase ---------- */}
      <section id="progress" className="scroll-mt-16 border-y border-line bg-surface-2/60 py-24">
        <Reveal className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Item>
            <div className="eyebrow mb-3">Progress you can see</div>
            <h2 className="max-w-[16ch]">Six weeks, one line, no guesswork</h2>
            <p className="lead mt-5 max-w-[46ch]">Every session lands as a point. Your goal is a line. The gap between them is the only number that matters, and Arc shows it shrinking.</p>
            <ul className="mt-7 grid gap-3 text-[14.5px] font-semibold text-ink-2">
              {CHECKS.map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <IconCheck size={13} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Item>
          <Item>
            <Lift className="card p-5 sm:p-7">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Elbow flexion · best rep</div>
                  <div className="mt-1 flex items-baseline gap-2 text-[32px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">
                    <AnimatedNumber value={129} suffix="°" duration={1.4} /> <span className="text-[14px] font-bold text-good">+18° since week 1</span>
                  </div>
                </div>
                <span className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-bold text-primary">goal 140°</span>
              </div>
              <ResponsiveContainer width="100%" height={230}>
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
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
                {[
                  ['Best', '129°'],
                  ['Mean', '125°'],
                  ['Per week', '2 sessions'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[12px] bg-surface-2 px-3 py-2.5">
                    <div className="text-[10.5px] font-bold tracking-[0.1em] text-muted uppercase">{k}</div>
                    <div className="mt-0.5 text-[15px] font-extrabold text-ink tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </Lift>
          </Item>
        </Reveal>
      </section>

      {/* ---------- Features ---------- */}
      <Reveal className="mx-auto max-w-[1200px] px-6 py-24 sm:px-10">
        <Item>
          <div id="features" className="mb-12 max-w-[60ch] scroll-mt-24">
            <div className="eyebrow mb-3">What you get</div>
            <h2>Numbers worth coming back to</h2>
          </div>
        </Item>
        <div className="grid gap-5 md:grid-cols-3">
          <Item className="md:col-span-2">
            <Lift className="card flex h-full flex-col gap-6 hover:border-primary/40 md:flex-row md:items-center">
              <div className="md:w-[46%]">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-navy text-sky">
                  <IconTarget size={22} />
                </span>
                <h3 className="mt-5 text-[20px]">Goal lines you can see</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Set a goal angle per exercise. Every chart draws it, so progress is a distance you can measure, not a feeling you have to trust.</p>
              </div>
              <div className="rounded-[16px] border border-line bg-surface-2/70 p-4 md:flex-1">
                <GoalSketch />
              </div>
            </Lift>
          </Item>
          <Item>
            <Lift className="card flex h-full flex-col hover:border-primary/40">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-navy text-sky">
                <IconCamera size={22} />
              </span>
              <h3 className="mt-5 text-[18px]">Every rep, in degrees</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Peak range per rep, set by set. The server recomputes the numbers from raw reps, so nothing is estimated twice.</p>
            </Lift>
          </Item>
          <Item>
            <Lift className="card flex h-full flex-col hover:border-primary/40">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-navy text-sky">
                <IconFlame size={22} />
              </span>
              <h3 className="mt-5 text-[18px]">Fatigue proxy</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">When range or tempo fades late in a set, Arc flags it. Honest labels: ROM decay and tempo drift, not a diagnosis.</p>
            </Lift>
          </Item>
          <Item>
            <Lift className="card flex h-full flex-col hover:border-primary/40">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-navy text-sky">
                  <IconUsers size={22} />
                </span>
                <span className="flex -space-x-2">
                  {['June Park', 'Theo Park', 'Mina Park'].map((n) => (
                    <span key={n} className="rounded-full ring-2 ring-surface">
                      <Avatar name={n} size={30} />
                    </span>
                  ))}
                </span>
              </div>
              <h3 className="mt-5 text-[18px]">Built for the household</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Profiles for everyone at home, any age, under one account. Switch who you are looking at in one click.</p>
            </Lift>
          </Item>
          <Item>
            <Lift className="card flex h-full flex-col hover:border-primary/40">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-navy text-sky">
                <IconShield size={22} />
              </span>
              <h3 className="mt-5 text-[18px]">Private by default</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Your sessions belong to your account. No clinic, no sharing, no scores you did not ask for.</p>
            </Lift>
          </Item>
        </div>
      </Reveal>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-16 border-t border-line bg-surface-2/60 py-24">
        <Reveal className="mx-auto grid max-w-[1200px] gap-10 px-6 sm:px-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Item>
            <div className="eyebrow mb-3">Questions</div>
            <h2 className="max-w-[14ch]">Short answers, no fine print</h2>
            <p className="lead mt-5 max-w-[40ch]">What Arc measures, who it is for, and what happens to your data.</p>
          </Item>
          <Item>
            <Accordion.Root type="single" collapsible defaultValue={FAQ[0]!.q} className="divide-y divide-line rounded-[20px] border border-line bg-surface shadow-card">
              {FAQ.map(({ q, a }) => (
                <Accordion.Item key={q} value={q} className="px-6">
                  <Accordion.Header className="m-0 text-[16px]">
                    <Accordion.Trigger className="group flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-[16px] font-bold text-ink focus-visible:rounded-[8px] focus-visible:ring-[3px] focus-visible:ring-primary/35 focus-visible:outline-none">
                      {q}
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-[transform,background-color,color] duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:bg-primary-soft group-data-[state=open]:text-primary">
                        <IconChevronDown size={16} />
                      </span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="faq-content overflow-hidden">
                    <p className="pb-5 text-[14.5px] leading-relaxed text-muted">{a}</p>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </Item>
        </Reveal>
      </section>

      {/* ---------- Call to action ---------- */}
      <Reveal className="mx-auto max-w-[1200px] px-6 py-24 sm:px-10">
        <Item>
          <div className="on-navy relative overflow-hidden rounded-[28px] bg-navy px-8 py-14 text-white shadow-pop ring-1 ring-white/10 sm:px-14">
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full bg-sky opacity-30 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-primary opacity-40 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-20 opacity-[0.08]">
              <Logo size={360} tone="white" />
            </div>
            <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <div className="eyebrow mb-3 text-sky">Start today</div>
                <h2 className="max-w-[18ch] text-white">Your first week starts with one account.</h2>
                <p className="mt-3 max-w-[48ch] text-[16px] text-white/75">Create the household account, add a profile, and load the demo data to see six weeks of progress before your first real session.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/signup" className="btn btn-lg group border-white bg-white text-navy hover:border-white hover:bg-sky hover:text-navy">
                  Create your account <IconArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link to="/login" className="btn btn-lg border-white/30 bg-white/5 text-white hover:border-white hover:bg-white/10 hover:text-white">
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </Item>
      </Reveal>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 sm:px-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <span className="flex items-center gap-2.5 text-[18px] font-extrabold tracking-[-0.02em] text-ink">
              <Logo size={26} /> {APP_NAME}
            </span>
            <p className="mt-3 max-w-[36ch] text-[14px] text-muted">Range of motion, measured at home. A personal tool for the whole household, not a clinical one.</p>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Product</div>
            <ul className="mt-3 grid gap-2 text-[14px] font-semibold">
              {NAV.map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="text-ink-2 no-underline hover:text-primary">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Account</div>
            <ul className="mt-3 grid gap-2 text-[14px] font-semibold">
              <li>
                <Link to="/signup" className="text-ink-2 no-underline hover:text-primary">
                  Create an account
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-ink-2 no-underline hover:text-primary">
                  Log in
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-5 text-[12.5px] font-semibold text-muted sm:px-10">
            <span>© 2026 {APP_NAME}</span>
            <span>Built at Hackknight</span>
            <span className="ml-auto">getarc.health</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
