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
  const dot = state === 'ok' ? 'bg-good' : state === 'down' ? 'bg-bad' : 'bg-white/40'
  const text = state === 'ok' ? 'Connected' : state === 'down' ? 'API unreachable' : 'Checking…'
  return (
    <div className="flex items-center gap-2 text-[12px] font-semibold text-white/60" title="API and database status">
      <span className={`h-2 w-2 rounded-full ${dot}`} /> {text}
    </div>
  )
}

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: IconChart, end: true },
  { to: '/profiles', label: 'Profiles', icon: IconUsers, end: false },
]

/** Signed-in frame: navy sidebar, light top bar with the profile switcher, page outlet. */
export function AppShell() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen md:grid md:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="on-navy bg-navy text-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-8 md:px-5 md:py-7">
        <div className="flex items-center gap-2 px-4 py-3 md:block md:p-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.02em] text-white no-underline hover:no-underline">
            <Logo size={32} />
            <span className="hidden sm:inline">{APP_NAME}</span>
          </Link>

          <nav className="ml-1 flex gap-1 md:mt-8 md:ml-0 md:flex-col" aria-label="Main">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="relative rounded-[12px] px-3 py-2 text-[14px] font-bold text-white/70 no-underline transition-colors hover:text-white hover:no-underline focus-visible:ring-[3px] focus-visible:ring-sky/50 focus-visible:outline-none md:px-3.5 md:py-2.5">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-[12px] bg-white shadow-pop" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <span className={`relative z-10 flex items-center gap-2 ${isActive ? 'text-navy' : ''}`}>
                      <Icon size={18} /> {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <button className="btn btn-sm ml-auto border-white/15 bg-white/5 px-2.5 text-white hover:border-white/40 hover:bg-white/10 hover:text-white md:hidden" onClick={logout} aria-label="Log out" title="Log out">
            <IconLogOut size={16} />
          </button>
        </div>

        <div className="hidden md:mt-auto md:flex md:flex-col md:gap-4 md:border-t md:border-white/10 md:pt-5">
          <ApiStatus />
          {user && (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={user.name} size={36} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold text-white">{user.name}</div>
                <div className="truncate text-[12px] text-white/60">{user.email}</div>
              </div>
            </div>
          )}
          <button className="btn btn-sm w-full border-white/15 bg-white/5 text-white hover:border-white/40 hover:bg-white/10 hover:text-white" onClick={logout}>
            <IconLogOut size={15} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur-md md:px-8">
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
