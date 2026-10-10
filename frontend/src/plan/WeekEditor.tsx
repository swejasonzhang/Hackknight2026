import { EXERCISES, isDiverseWeek, MAX_DAY_ITEMS, muscleOf, MUSCLES, sideLabel, titleForDay, WEEKDAY_NAMES, type ExerciseId, type ProgramDay, type ProgramDto, type ProgramItem, type Side } from '@arc/dependencies'
import { useEffect, useId, useState } from 'react'
import { api } from '../api/client'
import { exerciseOptions, MUSCLE_OPTIONS, type Target } from '../components/muscleOptions'
import { Select } from '../components/Select'
import { Alert, Lamp } from '../components/ui'

/** Monday first, the way a training week reads. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const SOURCE: Record<ProgramDto['source'], string> = { gemini: "Arc's week (Gemini)", arc: "Arc's week", demo: 'Demo week', member: 'Your own week' }
const SIDES: { value: Side; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
]

interface DraftDay {
  title: string
  /** The member typed the title; otherwise it follows what the day holds. */
  titled: boolean
  items: ProgramItem[]
}
type Draft = Partial<Record<number, DraftDay>>

/** The list with the items at `a` and `b` swapped. */
function swap<T>(items: T[], a: number, b: number): T[] {
  ;[items[a], items[b]] = [items[b]!, items[a]!]
  return items
}

function toDraft(program: Pick<ProgramDto, 'days'> | null): Draft {
  const draft: Draft = {}
  for (const d of program?.days ?? []) draft[d.weekday] = { title: d.title, titled: false, items: d.items.map((i) => ({ ...i })) }
  return draft
}

interface Props {
  profileId: string
  /** The week in force, or null before there is one. */
  program: ProgramDto | null
  onSaved: (program: ProgramDto) => void
  /** Offer the profile's earlier weeks to start from. */
  history?: boolean
  /** The side a new one-sided movement starts on. */
  side?: Side
}

/**
 * The week, by hand (ADR-0026): any day a training day or a rest day, several movements a day,
 * each picked for a muscle group (the back as upper back, lats and lower back), in any order, with
 * its own sets, reps, rest, goal and side. Saving makes it the week in force; the earlier ones
 * stay in history and can be started from again.
 */
export function WeekEditor({ profileId, program, onSaved, history = false, side = 'right' }: Props) {
  const base = useId()
  const [draft, setDraft] = useState<Draft>(() => toDraft(program))
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [versions, setVersions] = useState<ProgramDto[]>([])
  const [from, setFrom] = useState<string>(program?.id ?? '')

  useEffect(() => {
    setDraft(toDraft(program))
    setDirty(false)
    setFrom(program?.id ?? '')
  }, [program])

  useEffect(() => {
    if (!history) return
    let cancelled = false
    api.plan
      .programs(profileId)
      .then((list) => !cancelled && setVersions(list))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [history, profileId, program])

  const change = (weekday: number, fn: (items: ProgramItem[]) => ProgramItem[]) => {
    setDraft((d) => {
      const day = d[weekday]
      if (!day) return d
      const items = fn([...day.items])
      return { ...d, [weekday]: { ...day, items, title: day.titled || !items.length ? day.title : titleForDay(items) } }
    })
    setDirty(true)
    setSavedAt(null)
  }

  const toggleDay = (weekday: number) => {
    setDraft((d) => ({ ...d, [weekday]: d[weekday] ? undefined : { title: '', titled: false, items: [] } }))
    setAdding(draft[weekday] ? null : weekday)
    setDirty(true)
    setSavedAt(null)
  }

  /** A new movement joins its muscle group, else goes last; its numbers follow the rest of the week. */
  const add = (weekday: number, exercise: ExerciseId, muscle: ProgramItem['muscle']) => {
    const like = Object.values(draft).flatMap((d) => d?.items ?? [])[0]
    const item: ProgramItem = { exercise, side, sets: like?.sets ?? 3, reps: like?.reps ?? 10, restSeconds: like?.restSeconds ?? 60, targetDeg: EXERCISES[exercise].targetDeg, ...(muscle ? { muscle } : {}) }
    change(weekday, (items) => {
      const group = muscleOf(item)
      const last = items.map((x) => muscleOf(x)).lastIndexOf(group)
      items.splice(last >= 0 ? last + 1 : items.length, 0, item)
      return items
    })
    setAdding(null)
  }

  const days = WEEK.filter((w) => draft[w]).map((weekday) => ({ weekday, ...draft[weekday]! }))
  const empty = days.find((d) => d.items.length === 0)

  const save = async () => {
    if (!days.length) return setError('Pick at least one training day.')
    if (empty) return setError(`Add a movement to ${WEEKDAY_NAMES[empty.weekday]}, or make it a rest day.`)
    setSaving(true)
    setError(null)
    try {
      const out: ProgramDay[] = days.map((d) => ({ weekday: d.weekday, title: d.title.trim() || titleForDay(d.items), items: d.items }))
      const saved = await api.plan.putProgram(profileId, { days: out })
      setSavedAt(Date.now())
      setDirty(false)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your week')
    } finally {
      setSaving(false)
    }
  }

  const startFrom = (id: string) => {
    const version = versions.find((v) => v.id === id)
    if (!version) return
    setFrom(id)
    setDraft(toDraft(version))
    setDirty(id !== program?.id)
    setSavedAt(null)
  }

  const undo = () => {
    setDraft(toDraft(program))
    setFrom(program?.id ?? '')
    setDirty(false)
    setError(null)
  }

  const varied = days.length < 2 || days.some((d) => !d.items.length) || isDiverseWeek(days)

  return (
    <div>
      {history && versions.length > 1 && (
        <div className="field-row field-row-stacked mb-4">
          <label htmlFor={`${base}-from`} className="field-label">
            Start from
          </label>
          <div className="field-cell">
            <Select<string>
              id={`${base}-from`}
              value={from}
              options={versions.map((v, i) => ({ value: v.id, label: `${v.active ? 'In force' : i === 0 ? 'Latest' : 'Earlier'} · ${SOURCE[v.source]} · ${new Date(v.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` }))}
              onChange={startFrom}
            />
          </div>
        </div>
      )}

      <ol className="border-t border-rule-strong">
        {WEEK.map((weekday) => {
          const day = draft[weekday]
          const name = WEEKDAY_NAMES[weekday]!
          return (
            <li key={weekday} className="border-b border-rule py-3">
              <div className="flex items-center justify-between gap-3">
                <span className={`t-label ${day ? 'text-navy' : ''}`}>{name}</span>
                <button type="button" className="btn btn-ghost t-label" aria-pressed={Boolean(day)} aria-label={`${name}: ${day ? 'training day' : 'rest day'}`} onClick={() => toggleDay(weekday)}>
                  {day ? 'Make it a rest day' : 'Rest · train this day'}
                </button>
              </div>
              {day && (
                <>
                  <input
                    className="input mt-2"
                    aria-label={`${name}'s title`}
                    value={day.title}
                    placeholder={day.items.length ? titleForDay(day.items) : 'Pick a movement below'}
                    maxLength={60}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, [weekday]: { ...day, title: e.target.value, titled: true } }))
                      setDirty(true)
                    }}
                  />
                  <ol className="mt-2">
                    {day.items.map((item, i) => {
                      const cfg = EXERCISES[item.exercise]
                      const key = `${weekday}-${i}`
                      const lower = cfg.name.toLowerCase()
                      const num = (field: 'sets' | 'reps' | 'restSeconds' | 'targetDeg') => (e: React.ChangeEvent<HTMLInputElement>) => change(weekday, (items) => items.map((x, k) => (k === i ? { ...x, [field]: Number(e.target.value) } : x)))
                      return (
                        <li key={key} className="border-b border-rule py-2 last:border-b-0">
                          {/* On a phone the muscle sits above the name and the controls wrap under it. */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                            <span className="t-meta w-full flex-none text-navy sm:w-[92px]">{MUSCLES[muscleOf(item)].name}</span>
                            <span className="min-w-[11rem] flex-1 text-[15px] text-ink">
                              {cfg.name}
                              <span className="t-meta block normal-case">
                                {sideLabel(item.exercise, item.side)} · {item.sets} × {item.reps} · {item.restSeconds} s · {item.targetDeg}°
                              </span>
                            </span>
                            <span className="ml-auto flex flex-none items-center gap-1">
                              <button type="button" className="btn btn-icon btn-sm" aria-label={`Move ${lower} up`} disabled={i === 0} onClick={() => change(weekday, (items) => swap(items, i - 1, i))}>
                                <span aria-hidden="true">↑</span>
                              </button>
                              <button type="button" className="btn btn-icon btn-sm" aria-label={`Move ${lower} down`} disabled={i === day.items.length - 1} onClick={() => change(weekday, (items) => swap(items, i, i + 1))}>
                                <span aria-hidden="true">↓</span>
                              </button>
                              <button type="button" className="btn btn-sm" aria-expanded={open === key} aria-label={`Change ${lower}`} onClick={() => setOpen(open === key ? null : key)}>
                                {open === key ? 'Done' : 'Change'}
                              </button>
                              <button type="button" className="btn btn-icon btn-sm" aria-label={`Remove ${lower}`} onClick={() => change(weekday, (items) => items.filter((_, k) => k !== i))}>
                                <span aria-hidden="true">×</span>
                              </button>
                            </span>
                          </div>
                          {open === key && (
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {(
                                [
                                  ['sets', 'Sets', 1, 10],
                                  ['reps', 'Reps', 1, 50],
                                  ['restSeconds', 'Rest (s)', 10, 600],
                                  ['targetDeg', 'Goal (°)', 0, 180],
                                ] as const
                              ).map(([field, label, min, max]) => (
                                <label key={field} className="flex flex-col gap-1">
                                  <span className="t-meta">{label}</span>
                                  <input className="input input-mono" type="number" min={min} max={max} value={item[field]} onChange={num(field)} aria-label={`${label} for ${lower}`} />
                                </label>
                              ))}
                              {cfg.sided && (
                                <div className="col-span-2 flex flex-col gap-1">
                                  <span className="t-meta">Side</span>
                                  <Select<Side> aria-label={`Side for ${lower}`} value={item.side} options={SIDES} onChange={(s) => change(weekday, (items) => items.map((x, k) => (k === i ? { ...x, side: s } : x)))} />
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                  {adding === weekday ? (
                    <AddMovement day={name} onAdd={(exercise, muscle) => add(weekday, exercise, muscle)} onCancel={() => setAdding(null)} />
                  ) : (
                    <button type="button" className="btn btn-sm mt-2" disabled={day.items.length >= MAX_DAY_ITEMS} onClick={() => setAdding(weekday)} aria-label={`Add a movement to ${name}`}>
                      + Add a movement{day.items.length >= MAX_DAY_ITEMS ? ` (${MAX_DAY_ITEMS} at most)` : ''}
                    </button>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ol>

      {!varied && <p className="t-meta mt-3 normal-case">The same body area on two training days running: muscles grow while they rest.</p>}
      {error && (
        <div className="mt-4">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-block" onClick={() => void save()} disabled={saving || !dirty}>
          <Lamp tone="primary" blink={saving} /> {saving ? 'Saving…' : 'Save my week'}
        </button>
        {dirty && (
          <button type="button" className="btn" onClick={undo}>
            Undo changes
          </button>
        )}
        {savedAt && !dirty && (
          <span className="t-mono flex items-center gap-2 text-ok" role="status">
            <Lamp tone="good" /> Saved · it's your week now
          </span>
        )}
      </div>
    </div>
  )
}

/** Picks a movement for a day: a muscle group first, then a movement that works it. */
function AddMovement({ day, onAdd, onCancel }: { day: string; onAdd: (exercise: ExerciseId, muscle: ProgramItem['muscle']) => void; onCancel: () => void }) {
  const base = useId()
  const [target, setTarget] = useState<Target>('all')
  const options = exerciseOptions(target)
  const [exercise, setExercise] = useState<ExerciseId>(options[0]!.value)
  const pickTarget = (next: Target) => {
    setTarget(next)
    const list = exerciseOptions(next)
    if (!list.some((o) => o.value === exercise)) setExercise(list[0]!.value)
  }
  return (
    <div className="mt-2 border border-rule bg-vellum p-3" role="group" aria-label={`Add a movement to ${day}`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-target`} className="t-meta">
            Target muscle
          </label>
          <Select<Target> id={`${base}-target`} value={target} options={MUSCLE_OPTIONS} onChange={pickTarget} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-exercise`} className="t-meta">
            Movement
          </label>
          <Select<ExerciseId> id={`${base}-exercise`} value={exercise} options={options} onChange={setExercise} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-sm btn-block" onClick={() => onAdd(exercise, target === 'all' ? undefined : target)}>
          Add
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
