import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { IconPlus, IconSparkle, IconTrash, IconUsers } from '../components/icons'
import { Alert, Avatar, Card, EmptyState, PageHeader, Skeleton } from '../components/ui'
import { formatDate } from '../format'
import { useProfiles } from '../hooks/useProfiles'

export function ProfilesPage() {
  const { profiles, selectedId, setSelectedId, reload, loading, error } = useProfiles()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null)

  const run = async (work: () => Promise<string>) => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ text: await work(), tone: 'good' })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const p = await api.profiles.create({ name, email: email || undefined })
      setName('')
      setEmail('')
      await reload()
      setSelectedId(p.id)
      return `Added ${p.name}.`
    })
  }

  const remove = (id: string, profileName: string) => {
    if (!window.confirm(`Delete ${profileName} and all of their sessions? This cannot be undone.`)) return
    void run(async () => {
      await api.profiles.delete(id)
      await reload()
      return `Deleted ${profileName}.`
    })
  }

  const seed = () =>
    void run(async () => {
      const r = await api.dev.seed()
      await reload()
      setSelectedId(r.profileId)
      return r.created ? `Loaded ${r.sessions} demo sessions.` : `Demo data already loaded (${r.sessions} sessions).`
    })

  return (
    <div className="page">
      <PageHeader eyebrow="Household" title="Profiles" subtitle="One profile per person who exercises. The selected profile is the one the dashboard shows." />
      {error && <Alert tone="bad">{error}</Alert>}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="layout" style={{ marginTop: message || error ? 14 : 0 }}>
        <section className="main">
          {loading && (
            <div className="profile-grid">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={140} />
              ))}
            </div>
          )}
          {!loading && profiles.length === 0 && (
            <EmptyState icon={<IconUsers />} title="No profiles yet" description="Add yourself or a family member using the form, or load the demo profile to explore." />
          )}
          {profiles.length > 0 && (
            <div className="profile-grid">
              {profiles.map((p) => {
                const isSelected = p.id === selectedId
                return (
                  <Card key={p.id} className={`profile-card ${isSelected ? 'selected' : ''}`}>
                    <div className="profile-top">
                      <Avatar name={p.name} size={44} />
                      <div style={{ minWidth: 0 }}>
                        <div className="profile-name">
                          {p.name}
                          {isSelected && <span className="badge tone-primary">viewing</span>}
                        </div>
                        <div className="muted small">{p.email ?? `Added ${formatDate(p.createdAt)}`}</div>
                      </div>
                    </div>
                    {p.notes && <div className="muted small">{p.notes}</div>}
                    <div className="profile-actions">
                      <button className="btn btn-sm" onClick={() => setSelectedId(p.id)} disabled={isSelected}>
                        {isSelected ? 'Selected' : 'View dashboard'}
                      </button>
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(p.id, p.name)} aria-label={`Delete ${p.name}`}>
                        <IconTrash width={16} height={16} /> Delete
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        <aside className="side">
          <Card title="Add a profile" subtitle="Name is all that's needed.">
            <form className="form" onSubmit={create} style={{ marginTop: 0 }}>
              <label className="field">
                Name
                <input className="input" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grandma June" />
              </label>
              <label className="field">
                Email (optional)
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
                <IconPlus width={16} height={16} /> Add profile
              </button>
            </form>
          </Card>
          <Card title="Demo data" subtitle='Creates "Demo Profile" with six weeks of seeded sessions.'>
            <button className="btn" onClick={seed} disabled={busy}>
              <IconSparkle width={16} height={16} /> Load demo data
            </button>
          </Card>
        </aside>
      </div>
    </div>
  )
}
