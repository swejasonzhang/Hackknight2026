import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { formatDateTime } from '../format'
import { useProfiles } from '../hooks/useProfiles'

export function ProfilesPage() {
  const { profiles, selectedId, setSelectedId, reload, loading, error } = useProfiles()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const p = await api.profiles.create({ name, email: email || undefined })
      setName('')
      setEmail('')
      await reload()
      setSelectedId(p.id)
      setMessage(`Added ${p.name}.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not add profile')
    } finally {
      setBusy(false)
    }
  }

  const seed = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const r = await api.dev.seed()
      await reload()
      setSelectedId(r.profileId)
      setMessage(r.created ? `Loaded ${r.sessions} demo sessions.` : `Demo data already loaded (${r.sessions} sessions).`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not load demo data')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Profiles</h2>
      </header>
      <div className="layout">
        <section className="main">
          <div className="card">
            {loading && <p className="muted">Loading…</p>}
            {error && <p className="error">{error}</p>}
            {!loading && profiles.length === 0 && <p className="muted">No profiles yet.</p>}
            {profiles.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className={p.id === selectedId ? 'selected' : ''}>
                      <td>{p.name}</td>
                      <td>{p.email ?? '–'}</td>
                      <td>{formatDateTime(p.createdAt)}</td>
                      <td>
                        {p.id === selectedId ? <span className="badge">selected</span> : <button onClick={() => setSelectedId(p.id)}>Select</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        <aside className="side">
          <form className="card" onSubmit={create}>
            <h3>Add a profile</h3>
            <label>
              Name
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Email (optional)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="primary" type="submit" disabled={busy || !name.trim()}>
              Add
            </button>
          </form>
          <div className="card">
            <h3>Demo data</h3>
            <p className="muted small">Creates "Demo Profile" with six weeks of seeded sessions so the dashboard has a trend to show.</p>
            <button onClick={seed} disabled={busy}>
              Load demo data
            </button>
          </div>
          {message && <p className="muted">{message}</p>}
        </aside>
      </div>
    </div>
  )
}
