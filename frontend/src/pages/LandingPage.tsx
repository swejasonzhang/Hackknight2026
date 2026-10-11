import { BODY_AREAS, EXERCISE_LIST, exercisesIn, generateDemoSessions, MUSCLE_IDS } from '@arc/dependencies'
import * as Accordion from '@radix-ui/react-accordion'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { APP_NAME, SITE_URL } from '../brand'
import { Logo } from '../components/icons'
import { DemoBoard } from '../components/landing/DemoBoard'
import { LiveJoint } from '../components/landing/LiveJoint'
import { Sparkline } from '../components/landing/Sparkline'
import { useAccountLinks } from '../components/landing/accountLinks'
import { useScrollSpy } from '../components/landing/useScrollSpy'
import { ease, Item, MaskLines, Page, parentVariants, Reveal, riseVariants, RuleDraw } from '../components/motion'
import { Alert, Strip } from '../components/ui'

/*
 * The landing page as a datasheet: a sticky title block whose index is a measuring scale with
 * five evenly spaced stations, beside a ruled readout column. The specimen stage (a whole 3D
 * body curling on a blueprint grid, tracked at shoulder, elbow and wrist) is the photograph; every section after it
 * rises into place as it arrives, and the readouts strip is a live board of the app's own charts,
 * the body with the muscles each movement works, and a demo household's leaderboard.
 */

const SECTIONS = [
  { id: 'joint', index: '01', label: 'Live body' },
  { id: 'method', index: '02', label: 'Method' },
  { id: 'readouts', index: '03', label: 'Readouts' },
  { id: 'household', index: '04', label: 'Household' },
  { id: 'faq', index: '05', label: 'FAQ' },
] as const
const SECTION_IDS: readonly string[] = SECTIONS.map((s) => s.id)

const HOST = new URL(SITE_URL).host

const SPEC: [string, string[]][] = [
  ['Movements', [`${EXERCISE_LIST.length} of them`, BODY_AREAS.map((a) => a.name.toLowerCase()).join(' · ')]],
  ['Muscles', [`${MUSCLE_IDS.length} groups, back in three`, 'target red · helpers yellow']],
  ['Week', ['yours to arrange', 'crossed off as you go']],
  ['Input', ['any webcam', 'right in the browser']],
  ['Output', ['peak per rep, weight held', 'set, session, leaderboard']],
  ['Account', ['one per household', 'a profile each']],
  ['Privacy', ['video stays on device', 'only angles saved']],
]

const METHOD = [
  { title: 'Tell Arc what you want', text: 'One account for everyone at home. Arc asks what you want from your body and builds your week: several movements a day for the muscle groups that day works. Change any of it by hand, any time.' },
  { title: 'Exercise on camera', text: "Press Start recording: the webcam tracks your whole body right in the browser and measures the working joint on every rep like a goniometer, while a figure beside you shows the movement done right and Arc listens and answers. Each set is saved as it finishes; the day's next movement is one tap away." },
  { title: 'Read the trend', text: 'Arc draws best rep, session mean and the goal on one line, so progress is a number you can watch, and the household leaderboard shows who moved most this week.' },
]

const HOUSEHOLD = [
  { title: 'One account', text: 'The household signs in once. Everything lives under that account, on any device with a browser.' },
  { title: 'A profile each', text: 'Every person who exercises gets a profile with their own sessions, goals and week. Switch between them in one step.' },
  { title: 'A friendly leaderboard', text: 'Everyone at home ranked on reps, sets, weight moved and steadiness, with an Arc score that factors them all in. Only your own household is compared, never strangers.' },
  { title: 'Any age', text: 'Range of motion is read the same way for a grandparent and a teenager: in degrees, against the goal they set.' },
  { title: 'Private by default', text: 'Sessions belong to the account that recorded them, and only that account sees them. The video never leaves the device.' },
]

const FAQ = [
  { q: 'What do I need?', a: 'A laptop, desktop or phone with a camera and a modern browser. Nothing to install: Arc tracks the movement in the browser, and you can check progress from any device.' },
  { q: 'Who is it for?', a: 'Anyone at home who wants to see their range of motion improve, at any age. One account per household, a profile per person. It is a personal tool, not a clinical one.' },
  {
    q: 'Which movements does it measure?',
    a: `${EXERCISE_LIST.length} in four areas, the same as the camera app: ${BODY_AREAS.map((a) => `${a.name.toLowerCase()} (${exercisesIn(a.id).map((e) => e.name.toLowerCase()).join(', ')})`).join('; ')}. One-arm and one-leg movements on the side you pick, the rest on whichever side faces the camera, always in degrees.`,
  },
  {
    q: 'How do I know I am doing it right?',
    a: 'Beside the camera, a 3D figure does the movement to your goal and back, with the muscles it works painted on: red where it targets, yellow where they help. While you record, Arc listens: ask about your form or say how it feels, and it answers from your last reps.',
  },
  {
    q: 'Is my data private?',
    a: "Your sessions belong to your account and nobody else sees them. The video never leaves your device: only the angle of each rep is saved. When Arc's words and voice are switched on, what you tell Arc and a session's numbers go to Gemini, and Arc's lines to ElevenLabs, to write and speak them; hands-free commands use your browser's own speech recognition.",
  },
]

const FINAL = ['Every rep in degrees, not points', 'Fifteen movements, the muscles each works', 'A week you arrange, crossed off as you go', 'Arc listening and answering while you move', 'A leaderboard for everyone at home', 'Private by default']

const pad = (n: number) => String(n).padStart(2, '0')

/** The index as a measuring scale: five stations spaced evenly from top to bottom, a cobalt fill that follows the scroll. */
function Scale({ active }: { active: string | null }) {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.3 })
  const activeIndex = SECTIONS.findIndex((s) => s.id === active)
  return (
    <nav aria-label="Sections" className="relative my-10 hidden flex-1 lg:flex">
      <span aria-hidden="true" className="absolute top-1 bottom-1 left-[3.5px] w-px bg-rule-strong" />
      <motion.span aria-hidden="true" className="absolute top-1 bottom-1 left-[2.5px] w-[3px] origin-top bg-cobalt" style={{ scaleY: reduce ? scrollYProgress : smooth }} />
      <ol className="relative flex flex-1 flex-col justify-between">
        {SECTIONS.map((s, i) => {
          const passed = i <= activeIndex
          const current = s.id === active
          return (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={current ? 'true' : undefined} className="group flex items-center gap-4 py-1 no-underline hover:no-underline">
                <motion.span
                  aria-hidden="true"
                  className={`relative z-10 block h-2 w-2 flex-none border ${passed ? 'border-cobalt bg-cobalt' : 'border-rule-strong bg-paper'}`}
                  animate={{ scale: current ? 1.5 : 1 }}
                  transition={{ duration: 0.24, ease }}
                />
                <span className="t-meta text-cobalt">{s.index}</span>
                <span className={`t-label transition-colors ${current ? 'text-navy' : 'text-muted group-hover:text-navy'}`}>{s.label}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function TitleBlock({ active }: { active: string | null }) {
  const account = useAccountLinks()
  return (
    <header className="border-b border-rule-strong lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0 lg:border-rule lg:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:block lg:p-0">
        <Link to="/" className="block no-underline hover:no-underline">
          <span className="flex items-center gap-3">
            <Logo size={28} />
            <span className="font-display text-[28px] leading-none font-bold tracking-[-0.02em] text-navy uppercase">{APP_NAME}</span>
          </span>
          <span className="t-label mt-3 block text-muted">Range-of-motion readout</span>
        </Link>
        <div className="hidden gap-2 sm:flex lg:hidden">
          {account.map((l) => (
            <Link key={l.to} to={l.to} className={l.primary ? 'btn btn-block' : 'btn'}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tablet: the same five stations as equal columns. */}
      <nav aria-label="Sections" className="hidden border-t border-rule sm:block lg:hidden">
        <ol className="grid grid-cols-5">
          {SECTIONS.map((s) => (
            <li key={s.id} className="border-r border-rule last:border-r-0">
              <a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} className="index-link justify-center border-l-0 py-3 aria-[current=true]:shadow-[inset_0_-2px_0_var(--cobalt)]">
                <span className="text-cobalt">{s.index}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Scale active={active} />

      <div className="hidden flex-col gap-2 lg:flex">
        {account.map((l) => (
          <Link key={l.to} to={l.to} className={l.primary ? 'btn btn-block btn-wide' : 'btn btn-wide'}>
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  )
}

export function LandingPage() {
  const active = useScrollSpy(SECTION_IDS)
  const account = useAccountLinks()
  // Set by the account page after a deletion, so the member sees it went through.
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const reduce = useReducedMotion()
  const sparkline = useMemo(
    () =>
      generateDemoSessions('demo', Date.now(), 2026, new Date().getTimezoneOffset())
        .filter((s) => s.exercise === 'elbow_flexion')
        .map((s) => s.summary.bestPeakDeg),
    [],
  )
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease, delay } })

  return (
    <Page className="min-h-screen bg-vellum text-ink">
      <div className="mx-auto max-w-[1560px] lg:grid lg:grid-cols-[200px_minmax(0,1fr)] min-[1440px]:grid-cols-[240px_minmax(0,1fr)]">
        <TitleBlock active={active} />

        <main className="min-w-0 max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
          {/* ---- 01 LIVE BODY: eyebrow, display headline, the specimen stage and its spec ---- */}
          <section id="joint" className="pt-5 sm:pt-6 lg:pt-8" aria-labelledby="headline">
            {notice && (
              <div className="mb-5">
                <Alert tone="good">{notice}</Alert>
              </div>
            )}
            <motion.div {...rise(0)} className="flex items-baseline justify-between gap-4">
              <span className="t-meta text-ink-2">Range of motion, read out</span>
              <span className="t-meta hidden sm:inline">
                {HOST} · V 01
              </span>
            </motion.div>
            <MaskLines id="headline" as="h1" trigger="mount" delay={0.1} className="t-display mt-5 sm:mt-8" lines={['Every rep,', 'in degrees.']} />
            <motion.div aria-hidden="true" className="mt-6 h-px origin-left bg-rule-strong sm:mt-10" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease, delay: 0.35 }} />

            <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-8">
              <motion.div {...rise(0.45)} className="min-w-0 lg:col-span-7">
                <LiveJoint />
                <p className="t-lead mt-6">Your webcam tracks your whole body right in the browser and measures the joint each movement works, every rep, like a goniometer. Arc shows the trend, so progress is a number you can watch, not a feeling you have to trust.</p>
                <div className="mt-6 flex flex-col gap-2 sm:hidden">
                  {account.map((l) => (
                    <Link key={l.to} to={l.to} className={l.primary ? 'btn btn-block btn-lg btn-wide' : 'btn btn-lg btn-wide'}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              </motion.div>

              <aside className="min-w-0 lg:col-span-5" aria-labelledby="spec-title">
                <motion.h2 {...rise(0.55)} id="spec-title" className="t-label pb-3 text-navy">
                  Spec
                </motion.h2>
                <motion.dl className="datasheet" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.65 } } }} initial={reduce ? 'show' : 'hidden'} animate="show">
                  {SPEC.map(([key, values]) => (
                    <motion.div key={key} variants={riseVariants} className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 border-b border-rule py-3 sm:grid-cols-[128px_minmax(0,1fr)]">
                      <dt className="t-label pt-0.5">{key}</dt>
                      <dd className="t-mono m-0 text-ink">
                        {values.map((v) => (
                          <span key={v} className="block">
                            {v}
                          </span>
                        ))}
                      </dd>
                    </motion.div>
                  ))}
                </motion.dl>
              </aside>
            </div>
          </section>

          {/* ---- 02 METHOD: the navy band, three steps arriving in sequence ---- */}
          <section id="method" className="on-navy mt-12 scroll-mt-6 bg-navy [--rule-strong:rgb(255_255_255/0.55)] sm:mt-16" aria-labelledby="method-title">
            <motion.div className="px-5 py-10 sm:px-8 sm:py-12" variants={parentVariants} initial={reduce ? 'show' : 'hidden'} whileInView="show" viewport={{ once: true, margin: '-80px' }}>
              <motion.header className="strip-head" variants={riseVariants}>
                <span className="strip-index text-white">02</span>
                <h2 id="method-title" className="t-strip text-white">
                  Method
                </h2>
                <span className="strip-aside t-meta">Three steps · the webcam does the measuring</span>
              </motion.header>
              <RuleDraw className="mt-6" />
              <ol className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-6">
                {METHOD.map((step, i) => (
                  <motion.li key={step.title} variants={riseVariants} className="flex gap-4 sm:block">
                    <span className="flex flex-none items-center gap-3 self-start pt-[7px] sm:mb-3 sm:pt-0">
                      <span className="t-meta text-white">{pad(i + 1)}</span>
                      <motion.span aria-hidden="true" className="hidden h-px flex-1 origin-left bg-white/40 sm:block sm:w-16" variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.6, ease } } }} />
                    </span>
                    <div>
                      <h3 className="t-strip text-white">{step.title}</h3>
                      <p className="t-desc mt-2 max-w-[36ch]">{step.text}</p>
                      {i === 2 && (
                        <div className="mt-4 max-w-[260px] text-[#8fb0ff]">
                          <Sparkline values={sparkline} goal={140} className="h-auto w-full" label="A demo trend: best elbow flexion per session over six weeks, rising toward a 140 degree goal" />
                          <div className="t-meta mt-1 flex justify-between">
                            <span>Week 1</span>
                            <span>Week 6</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          </section>

          {/* ---- 03 READOUTS: the app's own charts on random demo data ---- */}
          <Strip id="readouts" index="03" title="Readouts" className="mt-12 scroll-mt-6 sm:mt-16" aside="Seven views · random demo data">
            <DemoBoard />
          </Strip>

          {/* ---- 04 HOUSEHOLD: ruled rows that slide in ---- */}
          <Strip id="household" index="04" title="Household" className="scroll-mt-6" aside="One account · a profile each">
            <Reveal>
              <ol className="border-t border-rule">
                {HOUSEHOLD.map((row, i) => (
                  <Item key={row.title}>
                    <li className="grid gap-2 border-b border-rule py-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-8">
                      <div className="flex items-baseline gap-3">
                        <span className="t-meta text-cobalt">{pad(i + 1)}</span>
                        <h3 className="t-strip">{row.title}</h3>
                      </div>
                      <p className="max-w-[60ch] text-[15px] leading-[1.6] text-ink-2">{row.text}</p>
                    </li>
                  </Item>
                ))}
              </ol>
            </Reveal>
          </Strip>

          {/* ---- 05 FAQ: the accordion as hairline rows ---- */}
          <Strip id="faq" index="05" title="FAQ" className="scroll-mt-6" aside="Short answers · no fine print">
            <Reveal>
              <Accordion.Root type="single" collapsible defaultValue={FAQ[0]!.q} className="border-t border-rule">
                {FAQ.map(({ q, a }, i) => (
                  <Item key={q}>
                    <Accordion.Item value={q} className="border-b border-rule">
                      <Accordion.Header className="m-0">
                        <Accordion.Trigger className="group flex w-full cursor-pointer items-baseline gap-4 py-4 text-left sm:gap-6">
                          <span className="t-meta w-9 flex-none text-cobalt">Q {pad(i + 1)}</span>
                          <span className="min-w-0 flex-1 font-sans text-[16px] font-medium text-ink transition-colors group-hover:text-cobalt">{q}</span>
                          <span className="w-4 flex-none text-center font-mono text-[18px] leading-none text-navy transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true">
                            <span className="group-data-[state=open]:hidden">+</span>
                            <span className="hidden group-data-[state=open]:inline">−</span>
                          </span>
                        </Accordion.Trigger>
                      </Accordion.Header>
                      <Accordion.Content className="faq-content overflow-hidden">
                        <p className="max-w-[64ch] pb-5 pl-[52px] text-[15px] leading-[1.6] text-ink-2 sm:pl-[60px]">{a}</p>
                      </Accordion.Content>
                    </Accordion.Item>
                  </Item>
                ))}
              </Accordion.Root>
            </Reveal>
          </Strip>

          {/* ---- Foot band ---- */}
          <section className="on-navy mt-4 bg-navy sm:mt-8" aria-labelledby="foot-title">
            <div className="grid gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <span className="t-meta">Week 01 of many</span>
                <MaskLines id="foot-title" className="t-display-sm mt-4 text-white" lines={['Start the', 'first week.']} />
                <Reveal className="mt-8 flex flex-wrap gap-3">
                  {account.map((l) => (
                    <Item key={l.to}>
                      <Link to={l.to} className={l.primary ? 'btn btn-block btn-lg' : 'btn btn-lg'}>
                        {l.label}
                      </Link>
                    </Item>
                  ))}
                </Reveal>
              </div>
              <Reveal className="lg:col-span-5">
                <ul className="t-mono border-t border-white/20 text-white">
                  {FINAL.map((t, i) => (
                    <Item key={t}>
                      <li className="flex gap-4 border-b border-white/20 py-3">
                        <span className="text-rail-muted">{pad(i + 1)}</span>
                        {t}
                      </li>
                    </Item>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>

          {/* ---- Footer index line ---- */}
          <footer className="t-meta mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule-strong pt-5">
            {/* The logo always leads back to the landing page: here, its top. */}
            <Link to="/" aria-label={`${APP_NAME} home page`} onClick={() => window.scrollTo({ top: 0 })} className="flex items-center gap-2 text-navy no-underline hover:no-underline">
              <Logo size={18} />
              {APP_NAME}
            </Link>
            <span>© 2026 {APP_NAME} · Built at Hackknight · a personal tool, not a clinical one</span>
            <nav aria-label="Footer" className="flex gap-5 sm:ml-auto">
              {[...account].reverse().map((l) => (
                <Link key={l.to} to={l.to}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </footer>
        </main>
      </div>
    </Page>
  )
}
