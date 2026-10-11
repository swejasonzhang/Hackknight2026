import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PublicOnly, RequireAuth } from './auth/RequireAuth'
import { ScrollToTop } from './components/ScrollToTop'
import { PageLoading } from './components/ui'
import { AppShell } from './layouts/AppShell'
import { AuthLayout } from './layouts/AuthLayout'
import { LandingPage } from './pages/LandingPage'
import { ProfilesProvider } from './profiles/ProfilesContext'

/** A page loaded when it is first visited: only the landing page ships with the first download. */
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })))
const SignupPage = page(() => import('./pages/SignupPage'), 'SignupPage')
const LoginPage = page(() => import('./pages/LoginPage'), 'LoginPage')
const WelcomePage = page(() => import('./pages/WelcomePage'), 'WelcomePage')
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const PlanPage = page(() => import('./pages/PlanPage'), 'PlanPage')
const ChallengesPage = page(() => import('./pages/ChallengesPage'), 'ChallengesPage')
const RecordPage = page(() => import('./pages/RecordPage'), 'RecordPage')
const ProfilesPage = page(() => import('./pages/ProfilesPage'), 'ProfilesPage')
const LeaderboardPage = page(() => import('./pages/LeaderboardPage'), 'LeaderboardPage')
const SessionDetailPage = page(() => import('./pages/SessionDetailPage'), 'SessionDetailPage')
const AccountPage = page(() => import('./pages/AccountPage'), 'AccountPage')
const BodyGallery = page(() => import('./pages/dev/BodyGallery'), 'BodyGallery')

/** Each page's title, for the browser's tab, its history and search results. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Arc · Every rep, in degrees: a webcam range-of-motion coach'],
  [/^\/signup/, 'Create an account · Arc'],
  [/^\/login/, 'Log in · Arc'],
  [/^\/welcome/, 'Getting to know you · Arc'],
  [/^\/dashboard/, 'Dashboard · Arc'],
  [/^\/plan/, 'Your week · Arc'],
  [/^\/challenges/, 'Challenges · Arc'],
  [/^\/record/, 'Record · Arc'],
  [/^\/profiles/, 'Profiles · Arc'],
  [/^\/leaderboard/, 'Leaderboard · Arc'],
  [/^\/sessions\//, 'Session · Arc'],
  [/^\/account/, 'Account · Arc'],
]
function usePageTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = TITLES.find(([path]) => path.test(pathname))?.[1] ?? 'Arc'
  }, [pathname])
}

/** Once the first page is up and the browser is idle, the pages a visitor most likely opens next are fetched ahead. */
function usePrefetch() {
  useEffect(() => {
    const next = () => {
      void import('./pages/DashboardPage')
      void import('./pages/SignupPage')
      void import('./pages/LoginPage')
    }
    // Safari before 17.4 has no requestIdleCallback.
    const idle = 'requestIdleCallback' in window
    const id = idle ? window.requestIdleCallback(next, { timeout: 4000 }) : window.setTimeout(next, 2500)
    return () => (idle ? window.cancelIdleCallback(id) : window.clearTimeout(id))
  }, [])
}

/**
 * URL map
 *   /               landing page, for everyone; the app's logo leads here, and a signed-in
 *                   user's buttons lead back into the app
 *   /signup, /login account pages
 *   /dashboard      progress for the selected profile, every chart folded behind a plus
 *   /plan           the week to arrange by hand beside the log, one day at a time (?day=YYYY-MM-DD)
 *   /challenges     fixed plans for a physique in a set time: the one under way, every one to pick
 *                   (?challenge=<id>), the body each builds by its finish, and the way to start it
 *   /record         record a session in the browser: webcam, pose tracking, reps, save
 *   /welcome        a full page between sign-up and the dashboard: the chat with Arc, then the week
 *                   it built (skippable; ?profile=<id> for an existing profile)
 *   /profiles       household profiles
 *   /leaderboard    everyone on the account ranked on their training
 *   /sessions/:id   one session, set by set
 *   /account        who is signed in, log out, and deleting the account
 *   /dev/bodies     development only: every movement's figure and the muscles it works
 */
export default function App() {
  usePrefetch()
  usePageTitle()
  return (
    <>
      <ScrollToTop />
      {/* The app shell and the sign-up layout hold their own boundary, so their frame stays while a page loads. */}
      <Suspense fallback={<PageLoading />}>
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

        {/* Arc's chat is its own full page between sign-up and the dashboard: no app rail. */}
        <Route
          path="/welcome"
          element={
            <RequireAuth>
              <ProfilesProvider>
                <WelcomePage />
              </ProfilesProvider>
            </RequireAuth>
          }
        />

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
          <Route path="/challenges" element={<ChallengesPage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>

        {import.meta.env.DEV && <Route path="/dev/bodies" element={<BodyGallery />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
