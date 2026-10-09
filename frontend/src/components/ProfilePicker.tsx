import { Link } from 'react-router-dom'
import { useProfiles } from '../hooks/useProfiles'
import { Avatar } from './ui'

/** Top-bar switcher for who the whole app is looking at. */
export function ProfilePicker() {
  const { profiles, selected, selectedId, setSelectedId, loading } = useProfiles()
  if (loading) return <span className="muted small">Loading profiles…</span>
  if (profiles.length === 0) {
    return (
      <span className="muted small">
        No profiles yet. <Link to="/profiles">Add the first one</Link>.
      </span>
    )
  }
  return (
    <label className="switcher">
      {selected && <Avatar name={selected.name} size={28} />}
      <span className="switcher-label">Viewing</span>
      <select className="input input-sm" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Who's exercising">
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
