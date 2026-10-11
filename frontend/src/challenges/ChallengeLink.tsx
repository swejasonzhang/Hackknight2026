import { CHALLENGES, challengeWeek, type ChallengeRunDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Lamp } from '../components/ui'

/**
 * The dashboard's line under its header while the profile is on a challenge: which one and the
 * week it is in, leading to /challenges. Nothing shows without one, a finished one, or when it
 * cannot load; the dashboard reads fine without it.
 */
export function ChallengeLink({ profileId }: { profileId: string }) {
  const [run, setRun] = useState<ChallengeRunDto | null>(null)

  useEffect(() => {
    let cancelled = false
    setRun(null)
    api.challenge
      .get(profileId)
      .then((r) => !cancelled && setRun(r))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [profileId])

  const challenge = run ? CHALLENGES[run.challengeId] : undefined
  if (!run || run.status !== 'active' || run.profileId !== profileId || !challenge) return null
  return (
    <Link to="/challenges" className="t-label mt-3 flex w-fit items-center gap-2 text-cobalt">
      <Lamp tone="primary" />
      Challenge: {challenge.name} · week {challengeWeek(run, challenge, Date.now())} of {challenge.weeks} →
    </Link>
  )
}
