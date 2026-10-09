import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAuth } from './auth/RequireAuth'
import { AppShell } from './layouts/AppShell'
import { AuthLayout } from './layouts/AuthLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { SignupPage } from './pages/SignupPage'
import { ProfilesProvider } from './profiles/ProfilesContext'

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <PublicOnly>
            <AuthLayout />
          </PublicOnly>
        }
      >
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route
        element={
          <RequireAuth>
            <ProfilesProvider>
              <AppShell />
            </ProfilesProvider>
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
