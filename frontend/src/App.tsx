import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api/client'
import { useAuth } from './auth/AuthContext'
import { PublicOnly, RequireAuth } from './auth/RequireAuth'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { SignupPage } from './pages/SignupPage'

export default function App() {
  const { status, user, logout } = useAuth()
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'down'>('checking')

  useEffect(() => {
    api
      .health()
      .then((h) => setApiStatus(h.ok && h.db === 'connected' ? 'ok' : 'down'))
      .catch(() => setApiStatus('down'))
  }, [])

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">ROM Tracker</span>
        {status === 'signedIn' && (
          <>
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/profiles">Profiles</NavLink>
          </>
        )}
        <span className={`api-status api-${apiStatus}`} title="API and database status">
          {apiStatus === 'ok' ? 'API connected' : apiStatus === 'down' ? 'API unreachable: run npm run dev' : 'Checking API…'}
        </span>
        {status === 'signedIn' && user && (
          <span className="user-menu">
            {user.name}
            <button onClick={logout}>Log out</button>
          </span>
        )}
      </nav>
      <Routes>
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <SignupPage />
            </PublicOnly>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profiles"
          element={
            <RequireAuth>
              <ProfilesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/sessions/:id"
          element={
            <RequireAuth>
              <SessionDetailPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
