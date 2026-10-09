import { Link } from 'react-router-dom'
import { useProfiles } from '../hooks/useProfiles'
import { Avatar } from './ui'

/** Top-bar switcher for who the whole app is looking at. */
export function ProfilePicker() {
  const { profiles, selected, selectedId, setSelectedId, loading } = useProfiles()
  if (loading) return <span className="text-[13px] text-muted">Loading profiles…</span>
  if (profiles.length === 0) {
    return (
      <span className="text-[13px] text-muted">
        No profiles yet. <Link to="/profiles">Add the first one</Link>.
      </span>
    )
  }
  return (
    <label className="inline-flex items-center gap-2.5">
      {selected && <Avatar name={selected.name} size={28} />}
      <span className="hidden text-[12px] font-semibold text-muted sm:inline">Viewing</span>
      <select className="input input-sm font-semibold" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Who's exercising">
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
