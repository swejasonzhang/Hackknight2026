import { Link } from 'react-router-dom'
import { useProfiles } from '../hooks/useProfiles'
import { Select } from './Select'
import { Avatar } from './ui'

/** The switcher for who the whole app is reading: an underlined mono readout, no box. */
export function ProfilePicker() {
  const { profiles, selected, selectedId, setSelectedId, loading } = useProfiles()
  if (loading) return <span className="t-meta">Loading profiles…</span>
  if (profiles.length === 0) {
    return (
      <span className="t-meta">
        No profiles yet · <Link to="/profiles">Add one →</Link>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-3">
      {selected && <Avatar name={selected.name} size={28} />}
      <span className="t-meta hidden sm:inline">Profile</span>
      <Select variant="readout" aria-label="Who's exercising" className="min-w-0" value={selectedId} options={profiles.map((p) => ({ value: p.id, label: p.name }))} onChange={setSelectedId} />
    </span>
  )
}
