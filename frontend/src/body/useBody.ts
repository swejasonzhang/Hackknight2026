import type { BodyDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * A profile's body as its training has grown it (GET /api/profiles/:id/body), loaded again when
 * the profile or `refresh` changes. Null while loading, for no profile, or when it could not load.
 */
export function useBody(profileId: string | null | undefined, refresh = 0): { body: BodyDto | null; error: string | null } {
  const [body, setBody] = useState<BodyDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setError(null)
    if (!profileId) {
      setBody(null)
      return
    }
    let cancelled = false
    // Another profile's body never shows under this one while it loads.
    setBody((b) => (b?.profileId === profileId ? b : null))
    api
      .body(profileId)
      .then((b) => {
        if (!cancelled) setBody(b)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the body')
      })
    return () => {
      cancelled = true
    }
  }, [profileId, refresh])
  return { body, error }
}
