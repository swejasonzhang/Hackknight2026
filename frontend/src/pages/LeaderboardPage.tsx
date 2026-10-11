import { Link } from 'react-router-dom'
import { Page } from '../components/motion'
import { EmptyState, PageHeader } from '../components/ui'
import { useProfiles } from '../hooks/useProfiles'
import { Leaderboard } from '../profiles/Leaderboard'

/**
 * /leaderboard: everyone on the account ranked on their training (ADR-0027), this week, over 30
 * days or all time, by the Arc score or any one measure. Only the household is compared.
 */
export function LeaderboardPage() {
  const { profiles, selectedId, loading } = useProfiles()
  return (
    <Page>
      <PageHeader eyebrow="Household · leaderboard" title="Leaderboard" subtitle="Everyone at home, ranked on reps, sets, weight moved and steadiness, and on an Arc score that factors them all in." />
      <div className="mt-2">
        {!loading && profiles.length === 0 ? (
          <EmptyState
            title="No profiles yet"
            description="The leaderboard ranks the people on this account. Add a profile, or load the demo profile to see one."
            action={
              <Link className="btn btn-block" to="/profiles">
                Go to profiles
              </Link>
            }
          />
        ) : (
          <Leaderboard selectedId={selectedId} refresh={profiles.length} />
        )}
      </div>
    </Page>
  )
}
