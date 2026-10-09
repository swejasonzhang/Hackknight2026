import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Wraps pages that need an account: visitors land on /signup. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <p className="muted">Checking your session…</p>
  if (status === 'signedOut') return <Navigate to="/signup" replace state={{ from: location.pathname }} />
  return children
}

/** Wraps /signup and /login: a signed-in user goes straight to the app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <p className="muted">Checking your session…</p>
  if (status === 'signedIn') return <Navigate to="/" replace />
  return children
}
