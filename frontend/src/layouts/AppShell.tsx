import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Hint } from '../components/Hint'
import { IconLogOut, Logo } from '../components/icons'
import { Avatar, Lamp, type Tone } from '../components/ui'

type ApiState = 'checking' | 'ok' | 'down'

/** Polls /api/health every 30 s: the lamp on the rail and on the phone bar. */
function useApiState(): ApiState {
  const [state, setState] = useState<ApiState>('checking')
  useEffect(() => {
    let cancelled = false
    const check = () =>
      api
        .health()
        .then((h) => !cancelled && setState(h.ok && h.db === 'connected' ? 'ok' : 'down'))
        .catch(() => !cancelled && setState('down'))
    void check()
    const id = setInterval(check, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
  return state
}

const API_TEXT: Record<ApiState, string> = { ok: 'Connected', down: 'API unreachable', checking: 'Checking…' }
const API_TONE: Record<ApiState, Tone> = { ok: 'good', down: 'bad', checking: 'default' }

function ApiLamp({ state }: { state: ApiState }) {
  return (
    <Hint label={`API and database: ${API_TEXT[state].toLowerCase()}. Checked every 30 seconds.`} side="right">
      <span tabIndex={0} className="inline-flex h-8 w-8 items-center justify-center">
        <Lamp tone={API_TONE[state]} blink={state === 'checking'} />
        <span className="sr-only">API status: {API_TEXT[state]}</span>
      </span>
    </Hint>
  )
}

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/plan', label: 'Plan', end: false },
  { to: '/profiles', label: 'Profiles', end: false },
]

/**
 * The signed-in frame: a 56 px navy instrument rail (wordmark, three vertical mono labels with a
 * sliding cobalt edge, a ruler, the API lamp, the account tag and log out) beside the vellum
 * bench where each page lays out its own panels. On phones the rail becomes a bottom bar.
 * There is no top bar: the profile switcher lives in the dashboard's measurement panel.
 */
export function AppShell() {
  const { user, logout } = useAuth()
  const apiState = useApiState()
  const location = useLocation()
  const outlet = useOutlet()
  const reduce = useReducedMotion()

  return (
    <div className="min-h-screen bg-vellum sm:pl-[56px]">
      <aside className="rail hidden sm:flex" aria-label="App">
        <Link to="/dashboard" className="flex h-[72px] w-full items-center justify-center border-b border-white/10 hover:no-underline" aria-label="Arc dashboard">
          <Logo size={26} tone="paper" />
        </Link>
        <nav aria-label="Main" className="rail-nav">
          {LINKS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className="rail-link">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="rail-edge" aria-hidden="true" className="absolute top-0 right-0 h-full w-[3px] bg-cobalt" transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} />}
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-3 border-t border-white/10 py-4">
          <ApiLamp state={apiState} />
          {user && (
            <Hint label={`${user.name} · ${user.email}`} side="right">
              <span tabIndex={0} role="img" aria-label={`Signed in as ${user.name}`} className="inline-flex">
                <Avatar name={user.name} size={32} />
              </span>
            </Hint>
          )}
          <button type="button" onClick={logout} aria-label="Log out" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center text-rail-muted transition-colors hover:text-white">
            <IconLogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-[1440px] px-4 pt-5 pb-[calc(80px+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-12 lg:px-8 lg:pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}>
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bar sm:hidden" aria-label="Main">
        <div className="flex items-center justify-center gap-1.5 border-r border-white/10">
          <Logo size={20} tone="paper" />
          <Lamp tone={API_TONE[apiState]} blink={apiState === 'checking'} />
          <span className="sr-only">API status: {API_TEXT[apiState]}</span>
        </div>
        {LINKS.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className="bar-link">
            {label}
          </NavLink>
        ))}
        <button type="button" onClick={logout} aria-label="Log out" className="flex cursor-pointer items-center justify-center border-l border-white/10 text-rail-muted">
          <IconLogOut size={18} />
        </button>
      </nav>
    </div>
  )
}
