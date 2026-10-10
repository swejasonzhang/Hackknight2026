import { motion, useReducedMotion } from 'motion/react'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { emailProblem, EMAIL_REQUIREMENT, nameProblem, NAME_REQUIREMENT } from '@arc/dependencies'
import { IconPlus } from '../components/icons'
import { ease, Page } from '../components/motion'
import { FieldMessage, useFieldRule } from '../components/TextField'
import { Alert, Avatar, EmptyState, Lamp, PageHeader, Skeleton } from '../components/ui'
import { formatDate } from '../format'
import { useProfiles } from '../hooks/useProfiles'

/* The ledger is a real <table> on tablet and desktop; on a phone every row becomes a stacked
 * block (tag beside the name line, then contact, notes, status and actions under it). */
const ROW = 'grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 border-b border-rule sm:table-row sm:border-b-0'
const EDGE = 'border-b-0 sm:border-b' // phone: the row carries the rule; sm+: the ledger's own cell rule
const CELL = `block ${EDGE} sm:table-cell`
const STACKED = `${CELL} col-start-2 pt-1 pb-3 sm:pt-[12px] sm:pb-[12px]`
const NAME = `flex min-h-[68px] items-center ${EDGE} sm:table-cell sm:min-h-0`

/**
 * The household register: a title block with the count readout, a navy head rule and ONE ruled
 * ledger in which every profile is a row (the selected one carries the cobalt edge and a VIEWING
 * lamp) and the last row is the new-entry form itself. A demo-data strip closes the sheet.
 */
export function ProfilesPage() {
  const { profiles, selectedId, setSelectedId, reload, loading, error } = useProfiles()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null)
  const formId = useId()
  const reduce = useReducedMotion()
  const ids = { name: `${formId}-name`, nameMsg: `${formId}-name-msg`, email: `${formId}-email`, emailMsg: `${formId}-email-msg` }
  const nameRule = useFieldRule({ value: name, problem: nameProblem })
  const emailRule = useFieldRule({ value: email, problem: emailProblem, optional: true })
  const canAdd = nameRule.valid && emailRule.valid

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
    if (!canAdd) return
    void run(async () => {
      const p = await api.profiles.create({ name: name.trim(), email: email.trim() || undefined })
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

  const count = profiles.length
  const firstLoad = loading && count === 0

  return (
    <Page>
      {/* The new-entry row lives inside the table, so its controls point at this form by id. */}
      <form id={formId} onSubmit={create} />

      <PageHeader
        eyebrow="Household / register"
        title="Profiles"
        subtitle="One profile per person who exercises. The selected profile is the one the dashboard shows."
        actions={
          <div className="flex items-baseline gap-3 sm:flex-col sm:items-end sm:gap-1">
            <span className="t-value">{firstLoad ? '–' : count}</span>
            <span className="t-meta">{count === 1 ? 'profile' : 'profiles'}</span>
          </div>
        }
      />

      <div className="rule-strong" />

      {(error || message) && (
        <div className="flex flex-col gap-2 py-4">
          {error && <Alert tone="bad">{error}</Alert>}
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
        </div>
      )}

      <table className="ledger block sm:table" aria-busy={busy || undefined}>
        <thead className="hidden sm:table-header-group">
          <tr>
            <th className="pl-3">Tag</th>
            <th>Name</th>
            <th>Contact</th>
            <th className="hidden lg:table-cell">Notes</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody className="block sm:table-row-group">
          {firstLoad &&
            [0, 1].map((i) => (
              <tr key={`loading-${i}`} className="block sm:table-row">
                <td colSpan={6} className="block sm:table-cell">
                  <Skeleton height={44} />
                </td>
              </tr>
            ))}

          {!loading && count === 0 && (
            <tr className="block sm:table-row">
              <td colSpan={6} className="block pt-0 sm:table-cell [&>div]:border-t-0">
                <EmptyState title="No profiles yet" description="Add the first person in the entry row below, or load the demo profile to look around." />
              </td>
            </tr>
          )}

          {profiles.map((p, index) => {
            const isSelected = p.id === selectedId
            return (
              <motion.tr
                key={p.id}
                className={`${ROW} ${isSelected ? 'shadow-[inset_3px_0_0_var(--cobalt)] sm:shadow-none' : ''}`}
                initial={reduce ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease, delay: 0.06 * index }}
              >
                <td className={`${CELL} pl-3 ${isSelected ? 'sm:shadow-[inset_3px_0_0_var(--cobalt)]' : ''}`}>
                  <Avatar name={p.name} size={44} />
                </td>
                <td className={NAME}>
                  <span className="font-sans text-[16px] font-medium text-ink">{p.name}</span>
                </td>
                <td className={`${STACKED} font-mono text-[12.5px] text-ink-2`}>{p.email ?? `Added ${formatDate(p.createdAt)}`}</td>
                {/* Notes: a stacked block on a phone (only when there are notes), dropped on a tablet, a cell on desktop. */}
                <td className={`text-[13.5px] text-muted lg:table-cell ${p.notes ? `${STACKED} sm:hidden` : 'hidden'}`}>{p.notes ?? '–'}</td>
                <td className={STACKED}>
                  {isSelected ? (
                    <span className="t-meta flex items-center gap-2 text-cobalt">
                      <Lamp tone="primary" /> Viewing
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lamp />
                      <span className="sr-only">Not viewing</span>
                    </span>
                  )}
                </td>
                <td className={STACKED}>
                  <div className="flex flex-wrap items-center gap-2">
                    {isSelected ? (
                      <button className="btn btn-sm" type="button" disabled>
                        Selected
                      </button>
                    ) : (
                      <Link to="/dashboard" className={`btn btn-sm ${busy ? 'pointer-events-none' : ''}`} aria-disabled={busy || undefined} onClick={() => setSelectedId(p.id)}>
                        View dashboard
                      </Link>
                    )}
                    <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={() => remove(p.id, p.name)} aria-label={`Delete ${p.name}`}>
                      Delete
                    </button>
                  </div>
                </td>
              </motion.tr>
            )
          })}

          {/* NEW ENTRY: the create form is the register's own last row. */}
          <tr className={`${ROW} border-b-0`}>
            <td className={`${CELL} pl-3 sm:border-b-0`}>
              <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center border border-rule-strong text-navy">
                <IconPlus size={18} strokeWidth={1.75} />
              </span>
            </td>
            <td className={`${NAME} sm:border-b-0 sm:pr-4`}>
              <div className="w-full">
                <div className="t-meta mb-2 sm:hidden">New entry</div>
                <label htmlFor={ids.name} className="sr-only">
                  Name
                </label>
                <input
                  id={ids.name}
                  form={formId}
                  className="input"
                  type="text"
                  required
                  placeholder="Name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={nameRule.touch}
                  aria-invalid={nameRule.bad ? 'true' : undefined}
                  aria-describedby={ids.nameMsg}
                />
                <FieldMessage id={ids.nameMsg} rule={nameRule} requirement={NAME_REQUIREMENT} />
              </div>
            </td>
            <td className={`${STACKED} sm:border-b-0 sm:pr-4`}>
              <label htmlFor={ids.email} className="sr-only">
                Email (optional)
              </label>
              <input
                id={ids.email}
                form={formId}
                className="input"
                type="email"
                placeholder="Email (optional)"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={emailRule.touch}
                aria-invalid={emailRule.bad ? 'true' : undefined}
                aria-describedby={ids.emailMsg}
              />
              <FieldMessage id={ids.emailMsg} rule={emailRule} requirement={EMAIL_REQUIREMENT} optional />
            </td>
            <td className="hidden lg:table-cell lg:border-b-0">
              <span className="t-meta">New entry</span>
            </td>
            <td className="hidden sm:table-cell sm:border-b-0" />
            <td className={`${STACKED} sm:border-b-0`}>
              <button className="btn btn-block w-full sm:w-auto" type="submit" form={formId} disabled={busy || !canAdd}>
                Add profile
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      {/* DEMO DATA strip under the register's second navy rule. */}
      <section className="rule-strong grid gap-3 border-b border-rule py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-6" aria-labelledby={`${formId}-demo`}>
        <h2 id={`${formId}-demo`} className="t-label text-navy">
          Demo data
        </h2>
        <p className="t-desc">Creates "Demo Profile" with six weeks of random sessions, different for every account.</p>
        <button className="btn" type="button" onClick={seed} disabled={busy}>
          Load demo data
        </button>
      </section>

      {count > 0 && (
        <p className="t-meta mt-6 normal-case">
          See how everyone here compares on the{' '}
          <Link to="/leaderboard" className="text-cobalt">
            leaderboard →
          </Link>
        </p>
      )}
    </Page>
  )
}
