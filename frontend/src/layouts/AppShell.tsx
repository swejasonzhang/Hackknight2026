import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME } from '../brand'
import { IconChart, IconUsers, Logo } from '../components/icons'
import { ProfilePicker } from '../components/ProfilePicker'
import { Avatar } from '../components/ui'

function ApiStatus() {
  const [state, setState] = useState<'checking' | 'ok' | 'down'>('checking')
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
  const dot = state === 'ok' ? 'bg-good shadow-[0_0_0_3px_var(--good-soft)]' : state === 'down' ? 'bg-bad shadow-[0_0_0_3px_var(--bad-soft)]' : 'bg-muted'
  const text = state === 'ok' ? 'Connected' : state === 'down' ? 'API unreachable' : 'Checking…'
  return (
    <div className="hidden items-center gap-2 text-[12px] text-muted md:flex" title="API and database status">
      <span className={`h-2 w-2 rounded-sm ${dot}`} /> {text}
    </div>
  )
}

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: IconChart, end: true },
  { to: '/profiles', label: 'Profiles', icon: IconUsers, end: false },
]

/** Signed-in frame: sidebar navigation, top bar with the profile switcher, page outlet. */
export function AppShell() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-md md:h-screen md:flex-col md:items-stretch md:gap-7 md:border-r md:border-b-0 md:px-4 md:py-6">
        <Link to="/dashboard" className="flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-wide text-ink uppercase no-underline hover:no-underline">
          <Logo size={30} />
          <span>{APP_NAME}</span>
        </Link>

        <nav className="flex gap-1 md:flex-col" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="relative rounded-sm px-3 py-2.5 font-display text-[15px] font-bold tracking-[0.08em] text-ink-2 uppercase no-underline transition-colors hover:text-ink hover:no-underline">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-sm border-l-[3px] border-primary bg-primary-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <span className={`relative z-10 flex items-center gap-2.5 ${isActive ? 'text-primary' : ''}`}>
                    <Icon /> {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:mt-auto md:ml-0 md:flex-col md:items-stretch md:gap-3 md:border-t md:border-line md:pt-4">
          <ApiStatus />
          {user && (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={user.name} size={34} />
              <div className="hidden min-w-0 md:block">
                <div className="truncate text-[14px] font-semibold text-ink">{user.name}</div>
                <div className="truncate text-[12px] text-muted">{user.email}</div>
              </div>
            </div>
          )}
          <button className="btn btn-ghost btn-sm whitespace-nowrap md:w-full" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-[57px] z-10 flex items-center gap-4 border-b border-line bg-canvas/80 px-5 py-3 backdrop-blur-md md:top-0 md:px-8">
          <ProfilePicker />
          <span className="flex-1" />
          <Link className="btn btn-ghost btn-sm" to="/profiles">
            Manage profiles
          </Link>
        </header>
        <main className="w-full max-w-[1240px] px-5 py-7 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
