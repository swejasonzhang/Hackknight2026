import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAuth } from './auth/RequireAuth'
import { AppShell } from './layouts/AppShell'
import { AuthLayout } from './layouts/AuthLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { PlanPage } from './pages/PlanPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { SignupPage } from './pages/SignupPage'
import { ProfilesProvider } from './profiles/ProfilesContext'

/**
 * URL map
 *   /               landing page, for everyone; the app's logo leads here, and a signed-in
 *                   user's buttons lead back into the app
 *   /signup, /login account pages
 *   /dashboard      progress for the selected profile, every chart folded behind a plus
 *   /plan           the plan beside the log, one day at a time (?day=YYYY-MM-DD)
 *   /profiles       household profiles
 *   /sessions/:id   one session, set by set
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
