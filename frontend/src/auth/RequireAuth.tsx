import type { ReactNode } from 'react'
import { IconSpinner } from '../components/icons'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function Checking() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[14px] font-semibold text-muted" role="status">
      <IconSpinner size={16} className="animate-spin" aria-hidden="true" /> Checking your session…
    </div>
  )
}

/** Wraps app pages: a visitor is sent to /login and returned here afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Checking />
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/** Wraps the landing, signup and login pages: a signed-in user goes straight to the app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <Checking />
  if (status === 'signedIn') return <Navigate to="/dashboard" replace />
  return children
}
