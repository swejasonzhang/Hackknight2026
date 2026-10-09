import type { ProfileDto } from '@ptg/dependencies'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

const STORAGE_KEY = 'ptg.selectedProfileId'

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Profile list plus the selected profile, remembered per browser. */
export function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileDto[]>([])
  const [selectedId, setSelectedIdState] = useState<string>(readStored)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.profiles.list()
      setProfiles(list)
      setError(null)
      setSelectedIdState((current) => (list.some((p) => p.id === current) ? current : (list[0]?.id ?? '')))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profiles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* private mode: selection just is not remembered */
    }
  }, [])

  const selected = profiles.find((p) => p.id === selectedId) ?? null
  return { profiles, selected, selectedId, setSelectedId, reload, loading, error }
}
