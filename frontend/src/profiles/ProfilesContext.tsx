import type { ProfileDto } from '@arc/dependencies'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'

const STORAGE_KEY = 'arc.selectedProfileId'

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export interface ProfilesState {
  profiles: ProfileDto[]
  selected: ProfileDto | null
  selectedId: string
  setSelectedId: (id: string) => void
  reload: () => Promise<void>
  loading: boolean
  error: string | null
}

const ProfilesContext = createContext<ProfilesState | null>(null)

/** The account's profiles and which one the whole app is looking at, remembered per browser. */
export function ProfilesProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo<ProfilesState>(
    () => ({ profiles, selected: profiles.find((p) => p.id === selectedId) ?? null, selectedId, setSelectedId, reload, loading, error }),
    [profiles, selectedId, setSelectedId, reload, loading, error],
  )
  return <ProfilesContext value={value}>{children}</ProfilesContext>
}

export function useProfiles(): ProfilesState {
  const value = useContext(ProfilesContext)
  if (!value) throw new Error('useProfiles must be used inside <ProfilesProvider>')
  return value
}
