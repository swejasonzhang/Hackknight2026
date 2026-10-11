import type { ChallengeRunDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '../api/client'

/**
 * A profile's challenge (GET /api/profiles/:id/challenge: the latest run, under way or finished,
 * which the server brings up to date first) and when each of the profile's sessions started, which
 * is what the run's progress counts. `run` is null when there is none (a 404) and undefined until
 * it is known: while loading, and when it could not load, with `error` saying why, since a start
 * then could leave a run nobody was shown. `starts` is null when the sessions could not load: the
 * run still shows, without its days trained. `setRun` takes the run a start returns, or null once
 * it is left.
 */
export function useChallengeRun(profileId: string | null | undefined) {
  const [run, setRun] = useState<ChallengeRunDto | null | undefined>(undefined)
  const [starts, setStarts] = useState<number[] | null>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    if (!profileId) {
      setRun(null)
      setStarts([])
      return
    }
    let cancelled = false
    setRun(undefined)
    // Settled apart: sessions that fail to load blank the progress, not the run.
    void Promise.allSettled([api.challenge.get(profileId), api.sessions.list(profileId)]).then(([r, s]) => {
      if (cancelled) return
      setStarts(s.status === 'fulfilled' ? s.value.map((x) => x.startedAt) : null)
      if (r.status === 'fulfilled') setRun(r.value)
      else if (r.reason instanceof ApiRequestError && r.reason.status === 404) setRun(null)
      else setError(r.reason instanceof Error ? r.reason.message : 'Could not load the challenge')
    })
    return () => {
      cancelled = true
    }
  }, [profileId])

  return { run, setRun, starts, error }
}
