import type { ProfileDto } from '@ptg/dependencies'
import { Link } from 'react-router-dom'

interface Props {
  profiles: ProfileDto[]
  selectedId: string
  onSelect: (id: string) => void
  loading: boolean
}

export function ProfilePicker({ profiles, selectedId, onSelect, loading }: Props) {
  if (loading) return <span className="muted">Loading profiles…</span>
  if (profiles.length === 0) {
    return (
      <span className="muted">
        No profiles yet. <Link to="/profiles">Add yourself or load demo data</Link>.
      </span>
    )
  }
  return (
    <label className="inline">
      Who's exercising?
      <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
