import { EXERCISE_LIST } from '@arc/dependencies'
import * as Accordion from '@radix-ui/react-accordion'
import { Link } from 'react-router-dom'
import { APP_NAME, SITE_URL } from '../brand'
import { Logo } from '../components/icons'
import { LiveJoint } from '../components/landing/LiveJoint'
import { DEMO_SESSIONS, ReadoutChart } from '../components/landing/ReadoutChart'
import { useScrollSpy } from '../components/landing/useScrollSpy'
import { Item, Page, Reveal } from '../components/motion'
import { Strip, Tag } from '../components/ui'

/*
 * The landing page as a datasheet: a sticky title block that is an index, beside a ruled
 * readout column. The specimen stage (the 3D elbow on a blueprint grid) is the photograph;
 * every section after it is a ruled strip of text, one navy band or one editorial chart.
 */

const SECTIONS = [
  { id: 'joint', index: '01', label: 'Joint' },
  { id: 'method', index: '02', label: 'Method' },
  { id: 'readouts', index: '03', label: 'Readouts' },
  { id: 'household', index: '04', label: 'Household' },
  { id: 'faq', index: '05', label: 'FAQ' },
] as const
const SECTION_IDS: readonly string[] = SECTIONS.map((s) => s.id)

const HOST = new URL(SITE_URL).host

const SPEC: [string, string[]][] = [
  ['Movements', EXERCISE_LIST.map((e) => e.name.toLowerCase())],
  ['Goals', [EXERCISE_LIST.map((e) => `${e.targetDeg}°`).join(' · ')]],
  ['Input', ['any webcam', 'the camera app']],
  ['Output', ['peak per rep', 'set and session']],
  ['Account', ['one per household', 'a profile each']],
  ['Privacy', ['yours', 'never shared']],
]

const METHOD = [
  { title: 'Create the household account', text: 'One account for everyone at home. Add a profile for each person who exercises and set a goal angle per movement.' },
  { title: 'Exercise on camera', text: 'The camera app on a laptop measures every rep like a goniometer, counts the set and files it to the right profile.' },
  { title: 'Read the trend', text: 'Arc draws best rep, session mean and the goal on one line, so progress is a number you can watch.' },
]

const HOUSEHOLD = [
  { title: 'One account', text: 'The household signs in once. Everything lives under that account, on any device with a browser.' },
  { title: 'A profile each', text: 'Every person who exercises gets a profile with their own sessions, goals and plan. Switch between them in one step.' },
  { title: 'Any age', text: 'Range of motion is read the same way for a grandparent and a teenager: in degrees, against the goal they set.' },
  { title: 'Private by default', text: 'Sessions belong to the account that recorded them. Nothing is shared with anyone unless you show them the screen.' },
]

const FAQ = [
  { q: 'What do I need?', a: 'A laptop or desktop with a webcam for the camera app. Arc itself runs in any browser, on any device, so you can check progress from your phone.' },
  { q: 'Who is it for?', a: 'Anyone at home who wants to see their range of motion improve, at any age. One account per household, a profile per person. It is a personal tool, not a clinical one.' },
  { q: 'Which movements does it measure?', a: `${EXERCISE_LIST.map((e) => e.name).join(', ')} today, on the left or right side, always in degrees.` },
  { q: 'Is my data private?', a: 'Your sessions belong to your account and nobody else sees them. The camera app writes to your account with its own key, and nothing is shared with anyone.' },
]

const FINAL = ['Every rep in degrees, not points', 'Three movements, left and right', 'A goal rule on every chart', 'A nudge when range fades late in a set', 'Profiles for everyone at home', 'Private by default']

const pad = (n: number) => String(n).padStart(2, '0')

function TitleBlock({ active }: { active: string | null }) {
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
          <Link to="/signup" className="btn btn-block">
            Create account
          </Link>
          <Link to="/login" className="btn">
            Log in
          </Link>
        </div>
      </div>

      <nav aria-label="Sections" className="hidden sm:block lg:mt-10">
        <ol className="flex flex-wrap gap-x-2 px-4 pb-3 sm:px-6 lg:block lg:p-0">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="index-link" aria-current={active === s.id ? 'true' : undefined}>
                <span className="text-cobalt">{s.index}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ol>
        <div className="ruler h-3 lg:hidden" aria-hidden="true" />
      </nav>

      <div className="ruler-v mt-8 hidden min-h-10 flex-1 lg:block" aria-hidden="true" />

      <div className="mt-8 hidden flex-col gap-2 lg:flex">
        <Link to="/signup" className="btn btn-block btn-wide">
          Create account
        </Link>
        <Link to="/login" className="btn btn-wide">
          Log in
        </Link>
      </div>
    </header>
  )
}

export function LandingPage() {
  const active = useScrollSpy(SECTION_IDS)

  return (
    <Page className="min-h-screen bg-vellum text-ink">
      <div className="mx-auto max-w-[1560px] lg:grid lg:grid-cols-[200px_minmax(0,1fr)] min-[1440px]:grid-cols-[240px_minmax(0,1fr)]">
        <TitleBlock active={active} />

        <main className="min-w-0 max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
          {/* ---- 01 JOINT: eyebrow, display headline, the specimen stage and its spec ---- */}
          <section id="joint" className="pt-5 sm:pt-6 lg:pt-8" aria-labelledby="headline">
            <div className="flex items-baseline justify-between gap-4">
              <span className="t-meta text-ink-2">Range of motion, read out</span>
              <span className="t-meta hidden sm:inline">
                {HOST} · V 01
              </span>
            </div>
            <h1 id="headline" className="t-display mt-5 sm:mt-8">
              <span className="block">Every rep,</span>
              <span className="block">in degrees.</span>
            </h1>
            <div className="rule-strong mt-6 sm:mt-10" />

            <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-8">
              <div className="min-w-0 lg:col-span-7">
                <LiveJoint />
                <p className="t-lead mt-6">A camera app measures every rep like a goniometer. Arc shows the trend, so progress is a number you can watch, not a feeling you have to trust.</p>
                <div className="mt-6 flex flex-col gap-2 sm:hidden">
                  <Link to="/signup" className="btn btn-block btn-lg btn-wide">
                    Create account
                  </Link>
                  <Link to="/login" className="btn btn-lg btn-wide">
                    Log in
                  </Link>
                </div>
              </div>

              <aside className="min-w-0 lg:col-span-5" aria-labelledby="spec-title">
                <h2 id="spec-title" className="t-label pb-3 text-navy">
                  Spec
                </h2>
                <dl className="datasheet">
                  {SPEC.map(([key, values]) => (
                    <div key={key} className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 border-b border-rule py-3 sm:grid-cols-[128px_minmax(0,1fr)]">
                      <dt className="t-label pt-0.5">{key}</dt>
                      <dd className="t-mono m-0 text-ink">
                        {values.map((v) => (
                          <span key={v} className="block">
                            {v}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
          </section>

          {/* ---- 02 METHOD: the column's one navy band, three steps on a ruler ---- */}
          <section id="method" className="on-navy mt-12 bg-navy [--rule-strong:rgb(255_255_255/0.55)] sm:mt-16" aria-labelledby="method-title">
            <div className="px-5 py-10 sm:px-8 sm:py-12">
              <header className="strip-head">
                <span className="strip-index text-white">02</span>
                <h2 id="method-title" className="t-strip text-white">
                  Method
                </h2>
                <span className="strip-aside t-meta">Three steps · the camera app does the measuring</span>
              </header>
              <div className="ruler mt-6 h-3" aria-hidden="true" />
              <Reveal>
                <ol className="mt-5 grid gap-8 sm:grid-cols-3 sm:gap-6">
                  {METHOD.map((step, i) => (
                    <Item key={step.title}>
                      <li className="flex gap-4 sm:block">
                        <span className="t-meta flex-none text-white sm:block">{pad(i + 1)}</span>
                        <div className="sm:mt-3">
                          <h3 className="t-strip text-white">{step.title}</h3>
                          <p className="t-desc mt-2 max-w-[36ch]">{step.text}</p>
                        </div>
                      </li>
                    </Item>
                  ))}
                </ol>
              </Reveal>
            </div>
          </section>

          {/* ---- 03 READOUTS: one editorial chart ---- */}
          <Strip
            id="readouts"
            index="03"
            title="Readouts"
            className="mt-12 sm:mt-16"
            aside={
              <span className="flex items-center gap-3">
                Elbow flexion · {DEMO_SESSIONS.length} sessions <Tag soft>Demo</Tag>
              </span>
            }
          >
            <ReadoutChart />
          </Strip>

          {/* ---- 04 HOUSEHOLD: ruled rows of text ---- */}
          <Strip id="household" index="04" title="Household" aside="One account · a profile each">
            <ol className="border-t border-rule">
              {HOUSEHOLD.map((row, i) => (
                <li key={row.title} className="grid gap-2 border-b border-rule py-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-8">
                  <div className="flex items-baseline gap-3">
                    <span className="t-meta text-cobalt">{pad(i + 1)}</span>
                    <h3 className="t-strip">{row.title}</h3>
                  </div>
                  <p className="max-w-[60ch] text-[15px] leading-[1.6] text-ink-2">{row.text}</p>
                </li>
              ))}
            </ol>
          </Strip>

          {/* ---- 05 FAQ: the accordion as hairline rows ---- */}
          <Strip id="faq" index="05" title="FAQ" aside="Short answers · no fine print">
            <Accordion.Root type="single" collapsible defaultValue={FAQ[0]!.q} className="border-t border-rule">
              {FAQ.map(({ q, a }, i) => (
                <Accordion.Item key={q} value={q} className="border-b border-rule">
                  <Accordion.Header className="m-0">
                    <Accordion.Trigger className="group flex w-full cursor-pointer items-baseline gap-4 py-4 text-left sm:gap-6">
                      <span className="t-meta w-9 flex-none text-cobalt">Q {pad(i + 1)}</span>
                      <span className="min-w-0 flex-1 font-sans text-[16px] font-medium text-ink">{q}</span>
                      <span className="w-4 flex-none text-center font-mono text-[18px] leading-none text-navy" aria-hidden="true">
                        <span className="group-data-[state=open]:hidden">+</span>
                        <span className="hidden group-data-[state=open]:inline">−</span>
                      </span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden">
                    <p className="max-w-[64ch] pb-5 pl-[52px] text-[15px] leading-[1.6] text-ink-2 sm:pl-[60px]">{a}</p>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </Strip>

          {/* ---- Foot band ---- */}
          <section className="on-navy mt-4 bg-navy sm:mt-8" aria-labelledby="foot-title">
            <div className="grid gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <span className="t-meta">Week 01 of many</span>
                <h2 id="foot-title" className="t-display-sm mt-4 text-white">
                  Start the first week.
                </h2>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/signup" className="btn btn-block btn-lg">
                    Create account
                  </Link>
                  <Link to="/login" className="btn btn-lg">
                    Log in
                  </Link>
                </div>
              </div>
              <ul className="t-mono border-t border-white/20 text-white lg:col-span-5">
                {FINAL.map((t, i) => (
                  <li key={t} className="flex gap-4 border-b border-white/20 py-3">
                    <span className="text-rail-muted">{pad(i + 1)}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---- Footer index line ---- */}
          <footer className="t-meta mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule-strong pt-5">
            <span className="flex items-center gap-2 text-navy">
              <Logo size={18} />
              {APP_NAME}
            </span>
            <span>© 2026 {APP_NAME} · Built at Hackknight · a personal tool, not a clinical one</span>
            <nav aria-label="Footer" className="flex gap-5 sm:ml-auto">
              <Link to="/login">Log in</Link>
              <Link to="/signup">Create account</Link>
            </nav>
          </footer>
        </main>
      </div>
    </Page>
  )
}
