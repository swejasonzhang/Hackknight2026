import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME } from '../brand'
import { IconChart, IconLogOut, IconUsers, Logo } from '../components/icons'
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
  const dot = state === 'ok' ? 'bg-good shadow-[0_0_8px_rgb(46_210_114/0.8)]' : state === 'down' ? 'bg-bad' : 'bg-muted'
  const text = state === 'ok' ? 'Connected' : state === 'down' ? 'API unreachable' : 'Checking…'
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium text-muted" title="API and database status">
      <span className={`h-2 w-2 rounded-full ${dot}`} /> {text}
    </div>
  )
}

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: IconChart, end: true },
  { to: '/profiles', label: 'Profiles', icon: IconUsers, end: false },
]

/** Signed-in frame: black sidebar with a glowing active pill, black top bar with the profile switcher, page outlet. */
export function AppShell() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen md:grid md:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-black md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-8 md:border-r md:border-b-0 md:px-5 md:py-7">
        <div className="flex items-center gap-2 px-4 py-3 md:block md:p-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 text-[20px] font-semibold tracking-[-0.02em] text-ink no-underline hover:no-underline">
            <Logo size={32} />
            <span className="hidden sm:inline">{APP_NAME}</span>
          </Link>

          <nav className="ml-1 flex gap-1 md:mt-8 md:ml-0 md:flex-col" aria-label="Main">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="relative rounded-full px-3.5 py-2 text-[14px] font-medium text-muted no-underline transition-colors hover:text-ink hover:no-underline focus-visible:ring-[3px] focus-visible:ring-primary/40 focus-visible:outline-none md:px-4 md:py-2.5">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-primary shadow-blue" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <span className={`relative z-10 flex items-center gap-2 ${isActive ? 'text-white' : ''}`}>
                      <Icon size={18} /> {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <button className="btn btn-sm ml-auto px-2.5 md:hidden" onClick={logout} aria-label="Log out" title="Log out">
            <IconLogOut size={16} />
          </button>
        </div>

        <div className="hidden md:mt-auto md:flex md:flex-col md:gap-4 md:border-t md:border-line md:pt-5">
          <ApiStatus />
          {user && (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={user.name} size={36} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">{user.name}</div>
                <div className="truncate text-[12px] text-muted">{user.email}</div>
              </div>
            </div>
          )}
          <button className="btn btn-sm w-full" onClick={logout}>
            <IconLogOut size={15} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-black/80 px-4 py-3 backdrop-blur-md md:px-8">
          <ProfilePicker />
          <span className="flex-1" />
          <Link className="btn btn-ghost btn-sm" to="/profiles">
            Manage profiles
          </Link>
        </header>
        <main className="w-full max-w-[1240px] px-5 py-7 md:px-8 md:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
