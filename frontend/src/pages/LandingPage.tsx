import * as Accordion from '@radix-ui/react-accordion'
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { APP_NAME } from '../brand'
import { IconActivity, IconArrowRight, IconCamera, IconChevronDown, IconFlame, IconPlus, IconTarget, IconTimer, Logo } from '../components/icons'
import { Blobs } from '../components/landing/Blobs'
import { Headline } from '../components/landing/Headline'
import { LiveArc } from '../components/landing/LiveArc'
import { AnimatedNumber, ease, Item, Lift, Reveal } from '../components/motion'

const NAV = [
  ['#how', 'How it works'],
  ['#progress', 'Progress'],
  ['#data', 'The data'],
  ['#faq', 'FAQ'],
] as const

const BENTO = [
  { icon: IconTarget, title: 'Know exactly how far you moved', text: 'Every rep is measured in degrees, like a goniometer that lives in your laptop. No guessing, no scores, just the angle.', wide: true },
  { icon: IconActivity, title: 'Three movements, both sides', text: 'Elbow flexion, shoulder abduction and seated knee extension, left or right, with a goal angle for each.' },
  { icon: IconCamera, title: 'Any webcam, anywhere', text: 'The camera app runs on a laptop in your living room. Arc runs in any browser, on any device.' },
  { icon: IconTimer, title: 'Track your progress', text: 'Peak range against the goal, rep-by-rep detail, a fatigue proxy and how often you show up each week.', wide: true, sketch: true },
]

const DAYS: [string, boolean][] = [
  ['M', true],
  ['T', false],
  ['W', true],
  ['T', false],
  ['F', true],
  ['S', false],
  ['S', false],
]

const DATA = [
  { icon: IconTarget, title: 'Goal lines', text: 'Set a goal angle per exercise. Every chart draws it, so progress is a distance, not a feeling.' },
  { icon: IconFlame, title: 'Fatigue proxy', text: 'When range or tempo fades late in a set, Arc flags it. ROM decay and tempo drift, never a diagnosis.' },
  { icon: IconActivity, title: 'Weekly consistency', text: 'Sessions per week, drawn as bars, because showing up is the number that moves every other number.' },
]

const BULLETS = [
  { title: 'Every rep, in degrees', text: 'Peak range per rep, set by set. The server recomputes the numbers from raw reps.' },
  { title: 'Best and mean per session', text: 'Two lines on one chart, so a great rep and a typical rep both count.' },
  { title: 'Set-by-set detail', text: 'Open any session and read every set, rep and rest.' },
  { title: 'Profiles for the household', text: 'One account, a profile per person, any age. Switch who you are looking at in one click.' },
]

const STATS: [number, string, string][] = [
  [3, '', 'Movements, both sides'],
  [1, '', 'Account for the whole household'],
  [0, '', 'Guesses per rep'],
]

const FAQ = [
  { q: 'What do I need?', a: 'A laptop or desktop with a webcam for the camera app. Arc itself runs in any browser, on any device, so you can check progress from your phone.' },
  { q: 'Who is it for?', a: 'Anyone at home who wants to see their range of motion improve, at any age. One account per household, a profile per person. It is a personal tool, not a clinical one.' },
  { q: 'Which movements does it measure?', a: 'Elbow flexion, shoulder abduction and seated knee extension today, on the left or right side, always in degrees.' },
  { q: 'Is my data private?', a: 'Your sessions belong to your account and nobody else sees them. The camera app writes to your account with its own key, and nothing is shared with a clinic.' },
]

const FINAL = ['Measures every rep in degrees, not points', 'Three movements, left and right', 'Goal lines on every chart', 'Fatigue proxy when range fades', 'Profiles for everyone at home', 'Private by default']

/** Six weeks of demo progress, two sessions a week, +18° overall. */
const DEMO = [111, 113, 114, 117, 118, 120, 121, 123, 125, 126, 128, 129].map((best, i) => ({ week: `W${Math.floor(i / 2) + 1}`, best, mean: best - 4 }))

function GoalSketch() {
  return (
    <svg viewBox="0 0 320 120" className="h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id="sketchFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="26" x2="320" y2="26" stroke="var(--chart-goal)" strokeWidth="2" strokeDasharray="6 4" />
      <text x="312" y="18" textAnchor="end" fontSize="11" fontWeight="600" fill="var(--chart-goal)">
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
    <div className="relative min-h-screen overflow-x-hidden bg-black">
      {/* ---------- Nav ---------- */}
      <motion.header {...rise(0)} className={`sticky top-0 z-30 border-b bg-black/80 backdrop-blur-md transition-[border-color] duration-300 ${scrolled ? 'border-line' : 'border-transparent'}`}>
        <div className="mx-auto flex h-[76px] max-w-[1280px] items-center gap-3 px-6 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-0.02em] text-ink no-underline hover:no-underline">
            <Logo size={34} />
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
          <Link to="/login" className="btn btn-white hidden sm:inline-flex">
            Log in
          </Link>
          <Link to="/signup" className="btn btn-primary">
            Get started
          </Link>
        </div>
      </motion.header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <Blobs />
        <div className="relative mx-auto flex max-w-[1100px] flex-col items-center px-6 pt-20 pb-10 text-center sm:px-10 lg:pt-28">
          <Headline lines={['See your range of motion.', 'In degrees.', 'No guessing.']} className="max-w-[16ch]" />
          <motion.p {...rise(0.55)} className="lead mt-7 max-w-[52ch] text-[19px] text-ink">
            A camera app measures every rep like a goniometer. Arc shows the trend, so progress is a number you can watch, not a feeling you have to trust.
          </motion.p>
          <motion.div {...rise(0.65)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup" className="btn btn-primary btn-lg group">
              Create your account <IconArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#how" className="btn btn-lg">
              See how it works
            </a>
          </motion.div>

          <motion.div {...rise(0.8)} className="relative mt-16 w-full max-w-[680px]">
            <div className="rounded-[36px] border border-primary/40 bg-surface p-2 shadow-pop">
              <div className="flex items-center gap-2 px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.1em] text-muted uppercase">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
                </span>
                <span className="ml-1 min-w-0 truncate">Arc camera · elbow flexion · right</span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2 py-0.5 text-[10.5px] text-ink">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bad" /> Live
                </span>
              </div>
              <div className="rounded-[28px] bg-black p-5 text-left sm:p-7">
                <LiveArc />
              </div>
              <div className="grid grid-cols-3 gap-2 px-1 pt-2 pb-1 text-[12px] font-medium">
                {[
                  [IconActivity, 'Set', '2 / 3'],
                  [IconTimer, 'Rest', '45 s'],
                  [IconTarget, 'Goal', '140°'],
                ].map(([Icon, label, value]) => (
                  <div key={label as string} className="flex items-center gap-2 rounded-full bg-ink/[0.06] px-3.5 py-2 text-muted">
                    <Icon size={14} className="shrink-0 text-primary" />
                    <span className="hidden sm:inline">{label as string}</span>
                    <span className="ml-auto whitespace-nowrap text-ink tabular-nums">{value as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- Progress should be measurable ---------- */}
      <Reveal className="mx-auto max-w-[1280px] px-6 py-24 text-center sm:px-10">
        <Item>
          <h2 id="how" className="display-2 mx-auto max-w-[18ch] scroll-mt-28">
            Progress should be measurable
          </h2>
          <p className="lead mx-auto mt-5 max-w-[58ch]">Every rep in degrees, every session on a line, every goal drawn where you can see it.</p>
        </Item>
        <div className="mt-14 grid gap-5 text-left md:grid-cols-12">
          {BENTO.map(({ icon: Icon, title, text, wide, sketch }) => (
            <Item key={title} className={wide ? 'md:col-span-7' : 'md:col-span-5'}>
              <Lift className="card flex h-full min-h-[300px] flex-col justify-between gap-10 rounded-[32px] p-7 sm:p-9">
                {sketch ? (
                  <div className="rounded-[20px] border border-line bg-ink/[0.03] p-4">
                    <GoalSketch />
                  </div>
                ) : (
                  <span className="ring-icon">
                    <Icon size={20} />
                  </span>
                )}
                <div>
                  <h3 className="feature-title">{title}</h3>
                  <p className="mt-4 max-w-[44ch] text-[15.5px] leading-relaxed text-ink-2">{text}</p>
                </div>
              </Lift>
            </Item>
          ))}
        </div>
        <Item>
          <div className="mt-12">
            <Link to="/signup" className="btn btn-primary btn-lg">
              Create your account
            </Link>
          </div>
        </Item>
      </Reveal>

      {/* ---------- Structured weeks ---------- */}
      <section id="progress" className="scroll-mt-16 py-24">
        <Reveal className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Item>
            <div className="flex gap-2" aria-label="Three sessions a week">
              {DAYS.map(([d, on], i) => (
                <span key={i} className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold ${on ? 'bg-primary text-white shadow-blue' : 'border border-line-strong text-muted'}`}>
                  {d}
                </span>
              ))}
            </div>
            <h2 className="display-2 mt-8 max-w-[12ch]">Structured weeks. Real numbers.</h2>
            <p className="lead mt-6 max-w-[42ch]">Three sessions a week, a goal per exercise, and one line that climbs toward it. Arc counts consistency as seriously as range.</p>
            <Link to="/signup" className="btn btn-primary btn-lg mt-8">
              Start the first week
            </Link>
          </Item>
          <Item>
            <Lift className="card p-5 sm:p-7">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Elbow flexion · best rep</div>
                  <div className="mt-1 flex items-baseline gap-2 text-[2.2rem] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
                    <AnimatedNumber value={129} suffix="°" duration={1.4} /> <span className="text-[14px] font-semibold text-good">+18° since week 1</span>
                  </div>
                </div>
                <span className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-semibold text-primary">goal 140°</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={DEMO} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="week" interval={1} tick={{ fill: 'var(--chart-axis)', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[90, 150]} unit="°" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 14, fontSize: 13, color: 'var(--ink)' }} formatter={(v) => `${Number(v)}°`} />
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
                  <div key={k} className="rounded-[14px] bg-surface-2 px-3 py-2.5">
                    <div className="text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">{k}</div>
                    <div className="mt-0.5 text-[15px] font-semibold text-ink tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </Lift>
          </Item>
        </Reveal>
      </section>

      {/* ---------- The data (white) ---------- */}
      <section id="data" className="on-light scroll-mt-16 bg-canvas py-24 text-ink">
        <Reveal className="mx-auto max-w-[1280px] px-6 text-center sm:px-10">
          <Item>
            <h2 className="display-2 mx-auto max-w-[18ch]">Let the data do the heavy lifting</h2>
          </Item>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {DATA.map(({ icon: Icon, title, text }) => (
              <Item key={title} className="flex flex-col items-center">
                <span className="ring-icon">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-[26px] font-light">{title}</h3>
                <p className="mt-3 max-w-[32ch] text-[15.5px] leading-relaxed text-muted">{text}</p>
              </Item>
            ))}
          </div>
          <Item>
            <Link to="/signup" className="btn btn-primary btn-lg mt-12">
              Train smarter
            </Link>
          </Item>
          <div className="mt-20 grid gap-8 text-left sm:grid-cols-2">
            {BULLETS.map(({ title, text }) => (
              <Item key={title} className="flex gap-4">
                <span className="plus-icon">
                  <IconPlus size={18} />
                </span>
                <div>
                  <h3 className="text-[22px] font-light">{title}</h3>
                  <p className="mt-1.5 max-w-[40ch] text-[15.5px] leading-relaxed text-ink-2">{text}</p>
                </div>
              </Item>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- Household + FAQ ---------- */}
      <Reveal className="mx-auto max-w-[1280px] px-6 py-24 sm:px-10">
        <Item>
          <h2 className="display-2 mx-auto max-w-[18ch] text-center">Built for the whole household</h2>
          <p className="lead mx-auto mt-5 max-w-[52ch] text-center">One account. A profile for everyone who exercises, at any age. Nothing shared with anyone.</p>
        </Item>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STATS.map(([value, suffix, label]) => (
            <Item key={label}>
              <div className="card flex flex-col items-center py-10 text-center">
                <div className="text-[4.5rem] leading-none font-semibold tracking-[-0.04em] text-ink tabular-nums">
                  <AnimatedNumber value={value} suffix={suffix} duration={1.2} />
                </div>
                <div className="mt-2 font-display text-[1.5rem] leading-tight tracking-[0.02em] text-primary uppercase">{label}</div>
              </div>
            </Item>
          ))}
        </div>
        <div id="faq" className="mt-20 grid scroll-mt-24 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Item>
            <div className="eyebrow mb-3">Questions</div>
            <h2 className="max-w-[14ch]">Short answers, no fine print</h2>
            <p className="lead mt-5 max-w-[40ch]">What Arc measures, who it is for, and what happens to your data.</p>
          </Item>
          <Item>
            <Accordion.Root type="single" collapsible defaultValue={FAQ[0]!.q} className="card divide-y divide-line p-0 sm:p-0">
              {FAQ.map(({ q, a }) => (
                <Accordion.Item key={q} value={q} className="px-6">
                  <Accordion.Header className="m-0 text-[16px]">
                    <Accordion.Trigger className="group flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-[17px] font-medium text-ink focus-visible:rounded-[8px] focus-visible:ring-[3px] focus-visible:ring-primary/40 focus-visible:outline-none">
                      {q}
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-muted transition-[transform,background-color,color,border-color] duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:border-primary group-data-[state=open]:bg-primary group-data-[state=open]:text-white">
                        <IconChevronDown size={16} />
                      </span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="faq-content overflow-hidden">
                    <p className="pb-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </Item>
        </div>
      </Reveal>

      {/* ---------- Blue band ---------- */}
      <section className="on-blue bg-canvas py-20 text-ink">
        <Reveal className="mx-auto flex max-w-[1280px] flex-col items-center px-6 text-center sm:px-10">
          <Item>
            <h2 className="display-2 mx-auto max-w-[20ch]">See it. Measure it. Improve it.</h2>
            <p className="mx-auto mt-5 max-w-[50ch] text-[17px] text-ink-2">Create the household account, add a profile, and load the demo data to see six weeks of progress before your first real session.</p>
            <Link to="/signup" className="btn btn-navy btn-lg mt-9">
              Create your account
            </Link>
          </Item>
        </Reveal>
      </section>

      {/* ---------- Final ---------- */}
      <Reveal className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 py-24 sm:px-10 lg:grid-cols-2">
        <Item>
          <h2 className="display-2 max-w-[12ch]">Stop guessing. Start measuring.</h2>
          <p className="lead mt-6 max-w-[42ch]">Range of motion is an arc. Arc draws it, every session, and shows it grow.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn btn-primary btn-lg">
              Get started for free
            </Link>
            <Link to="/login" className="btn btn-lg">
              Log in
            </Link>
          </div>
        </Item>
        <Item>
          <ul className="grid gap-4">
            {FINAL.map((t) => (
              <li key={t} className="flex items-center gap-4 text-[17px] text-ink-2">
                <span className="ring-icon h-8 w-8 border-[1.5px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Item>
      </Reveal>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-8 gap-y-4 px-6 py-8 text-[13px] text-muted sm:px-10">
          <span className="flex items-center gap-2.5 text-[18px] font-semibold text-ink">
            <Logo size={26} /> {APP_NAME}
          </span>
          <nav className="flex flex-wrap gap-5" aria-label="Footer">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="text-muted no-underline hover:text-ink">
                {label}
              </a>
            ))}
            <Link to="/signup" className="text-muted no-underline hover:text-ink">
              Sign up
            </Link>
            <Link to="/login" className="text-muted no-underline hover:text-ink">
              Log in
            </Link>
          </nav>
          <span className="ml-auto">© 2026 {APP_NAME} · Built at Hackknight · A personal tool, not a clinical one.</span>
        </div>
      </footer>
    </div>
  )
}
