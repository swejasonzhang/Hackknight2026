import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api/client'
import { DashboardPage } from './pages/DashboardPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { SessionPage } from './pages/SessionPage'

export default function App() {
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
        <NavLink to="/session">Session</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/profiles">Profiles</NavLink>
        <span className={`api-status api-${apiStatus}`} title="API and database status">
          {apiStatus === 'ok' ? 'API connected' : apiStatus === 'down' ? 'API unreachable: run npm run dev' : 'Checking API…'}
        </span>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/session" replace />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
      </Routes>
    </div>
  )
}
