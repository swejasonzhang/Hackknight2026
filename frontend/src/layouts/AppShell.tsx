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
  const text = state === 'ok' ? 'Connected' : state === 'down' ? 'API unreachable' : 'Checking…'
  return (
    <div className={`api-status api-${state}`} title="API and database status">
      <span className="dot" /> {text}
    </div>
  )
}

/** Signed-in frame: sidebar navigation, top bar with the profile switcher, page outlet. */
export function AppShell() {
  const { user, logout } = useAuth()
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <Logo />
          <span>{APP_NAME}</span>
        </Link>
        <nav className="sidenav" aria-label="Main">
          <NavLink to="/" end>
            <IconChart /> Dashboard
          </NavLink>
          <NavLink to="/profiles">
            <IconUsers /> Profiles
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <ApiStatus />
          {user && (
            <div className="user-chip">
              <Avatar name={user.name} size={32} />
              <div className="user-meta">
                <div className="user-name">{user.name}</div>
                <div className="muted small">{user.email}</div>
              </div>
            </div>
          )}
          <button className="btn btn-ghost btn-sm btn-block" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <ProfilePicker />
          <span className="topbar-spacer" />
          <Link className="btn btn-ghost btn-sm" to="/profiles">
            Manage profiles
          </Link>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
