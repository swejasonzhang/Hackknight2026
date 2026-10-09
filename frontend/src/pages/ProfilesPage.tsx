import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { IconPlus, IconSparkle, IconTrash, IconUsers } from '../components/icons'
import { Item, Lift, Page, Stagger } from '../components/motion'
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
    <Page>
      <PageHeader eyebrow="Household" title="Profiles" subtitle="One profile per person who exercises. The selected profile is the one the dashboard shows." />
      {(error || message) && (
        <div className="mb-5">
          {error && <Alert tone="bad">{error}</Alert>}
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div>
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} height={168} />
              ))}
            </div>
          )}
          {!loading && profiles.length === 0 && (
            <EmptyState icon={<IconUsers size={44} strokeWidth={1.5} />} title="No profiles yet" description="Add yourself or a family member using the form, or load the demo profile to explore." />
          )}
          {profiles.length > 0 && (
            <Stagger className="grid gap-4 sm:grid-cols-2">
              {profiles.map((p) => {
                const isSelected = p.id === selectedId
                return (
                  <Item key={p.id}>
                    <Lift className={`card flex h-full flex-col gap-5 ${isSelected ? 'ring-2 ring-primary/50' : ''}`}>
                      <div className="flex items-center gap-3.5">
                        <Avatar name={p.name} size={52} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
                            <span className="truncate">{p.name}</span>
                            {isSelected && <span className="badge bg-primary-soft text-primary">viewing</span>}
                          </div>
                          <div className="truncate text-[13px] text-muted">{p.email ?? `Added ${formatDate(p.createdAt)}`}</div>
                        </div>
                      </div>
                      {p.notes && <div className="text-[13px] text-muted">{p.notes}</div>}
                      <div className="mt-auto flex gap-2">
                        <button className="btn btn-sm" onClick={() => setSelectedId(p.id)} disabled={isSelected}>
                          {isSelected ? 'Selected' : 'View dashboard'}
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(p.id, p.name)} aria-label={`Delete ${p.name}`}>
                          <IconTrash size={15} /> Delete
                        </button>
                      </div>
                    </Lift>
                  </Item>
                )
              })}
            </Stagger>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Add a profile" subtitle="A name is all that's needed.">
            <form className="flex flex-col gap-4" onSubmit={create}>
              <div className="field">
                <label htmlFor="profile-name">Name</label>
                <input id="profile-name" className="input" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grandma June" />
              </div>
              <div className="field">
                <label htmlFor="profile-email">Email (optional)</label>
                <input id="profile-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
                <IconPlus size={16} /> Add profile
              </button>
            </form>
          </Card>
          <Card title="Demo data" subtitle='Creates "Demo Profile" with six weeks of seeded sessions.'>
            <button className="btn" onClick={seed} disabled={busy}>
              <IconSparkle size={16} /> Load demo data
            </button>
          </Card>
        </div>
      </div>
    </Page>
  )
}
