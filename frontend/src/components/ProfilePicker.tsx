import { Link } from 'react-router-dom'
import { useProfiles } from '../hooks/useProfiles'
import { Avatar } from './ui'

/** Top-bar switcher for who the whole app is looking at. */
export function ProfilePicker() {
  const { profiles, selected, selectedId, setSelectedId, loading } = useProfiles()
  if (loading) return <span className="text-[13px] font-semibold text-muted">Loading profiles…</span>
  if (profiles.length === 0) {
    return (
      <span className="text-[13px] font-semibold text-muted">
        No profiles yet. <Link to="/profiles">Add the first one</Link>.
      </span>
    )
  }
  return (
    <label className="inline-flex items-center gap-2.5">
      {selected && <Avatar name={selected.name} size={30} />}
      <span className="hidden text-[12px] font-bold tracking-[0.08em] text-muted uppercase sm:inline">Viewing</span>
      <select className="input input-sm font-bold" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Who's exercising">
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
