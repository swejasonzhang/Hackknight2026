import { Link, Outlet, useLocation } from 'react-router-dom'
import { APP_NAME } from '../brand'
import { Logo } from '../components/icons'
import { Lamp } from '../components/ui'

const STEPS = ['Account', 'Profile', 'Plan']

/**
 * Account pages: a navy masthead band (wordmark, a back link, the step ruler and the display
 * title) over the vellum bench, where the datasheet sits off-centre with a ruled margin of
 * notes beside it and deliberate emptiness to its right.
 */
export function AuthLayout() {
  const { pathname } = useLocation()
  const signup = pathname === '/signup'
  const title = signup ? 'Create account' : 'Log in'
  const notes = signup
    ? ['One account for the household. A profile each.', 'After this: add a profile, then run the camera app.']
    : ['Pick up where you left off.', 'Demo data: six weeks of random sessions, one click away.']

  return (
    <div className="min-h-screen bg-vellum">
      <header className="masthead on-navy">
        <div className="mx-auto flex min-h-[160px] max-w-[1280px] flex-col justify-between px-5 py-5 sm:min-h-[220px] sm:px-8 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 text-white no-underline hover:no-underline">
              <Logo size={28} tone="paper" />
              <span className="font-display text-[15px] font-semibold tracking-[0.02em]">{APP_NAME}</span>
              <span className="t-meta hidden text-rail-muted sm:inline">Range-of-motion readout</span>
            </Link>
            <Link to="/" className="t-meta text-rail-muted hover:text-white">
              ← Back to getarc.health
            </Link>
          </div>
          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Steps">
              {STEPS.map((step, i) => {
                const lit = i === 0
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span className={`t-meta flex items-center gap-2 ${lit ? 'text-white' : 'text-rail-muted'}`}>
                      <Lamp tone={lit ? 'primary' : 'default'} />
                      0{i + 1} {step}
                    </span>
                    {i < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-6 bg-white/30 sm:w-10" />}
                  </li>
                )
              })}
            </ol>
            <h1 className="t-display-sm text-white sm:text-right">{title}</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="panel max-w-[640px] p-5 sm:p-7">
            <Outlet />
          </div>
        </div>
        <aside className="ruler-v hidden pl-8 lg:col-span-4 lg:col-start-9 lg:block" aria-label="Notes">
          <ol className="t-meta flex flex-col gap-10 text-ink-2">
            {notes.map((n, i) => (
              <li key={n} className="flex gap-4">
                <span className="text-muted">{String((i + 1) * 10).padStart(2, '0')}</span>
                <span className="max-w-[24ch] leading-[1.7]">{n}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}
