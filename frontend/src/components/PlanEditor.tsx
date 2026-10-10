import { EXERCISE_LIST, type ExerciseId, type PlanDto, type PlanInput, type Side } from '@arc/dependencies'
import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { api } from '../api/client'
import { Select } from './Select'
import { Alert, Lamp } from './ui'

interface Props {
  profileId: string
  plan: PlanDto | null
  onSaved: (plan: PlanDto) => void
  /** Stack each label over its control, for a narrow column. */
  compact?: boolean
}

const EXERCISE_OPTIONS = EXERCISE_LIST.map((ex) => ({ value: ex.id, label: ex.name }))
const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
]

/** The plan as a datasheet: one ruled row per setting, the save as the sheet's last row. */
export function PlanEditor({ profileId, plan, onSaved, compact = false }: Props) {
  const [form, setForm] = useState<PlanInput>(toForm(plan))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const base = useId()
  const id = (k: string) => `${base}-${k}`

  useEffect(() => {
    setForm(toForm(plan))
  }, [plan])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await api.plan.put(profileId, form))
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save plan')
    } finally {
      setSaving(false)
    }
  }

  const num = (key: keyof PlanInput) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(e.target.value) })

  const row = (key: string, label: string, control: React.ReactNode) => (
    <div className={compact ? 'field-row field-row-stacked' : 'field-row'}>
      <label htmlFor={id(key)} className="field-label">
        {label}
      </label>
      <div className="field-cell">{control}</div>
    </div>
  )

  return (
    <form onSubmit={submit} className={compact ? 'max-w-[640px] lg:max-w-none' : 'max-w-[640px]'}>
      <p className="t-desc mb-4">{plan ? 'Recording this movement uses this plan: its sets, reps, rest and goal. Other movements follow your week.' : 'No plan yet. Recording follows your week, or your goal\'s ranges; save one to set your own numbers.'}</p>
      <div className="datasheet">
        {row(
          'exercise',
          'Exercise',
          <Select<ExerciseId> id={id('exercise')} value={form.exercise} options={EXERCISE_OPTIONS} onChange={(exercise) => setForm({ ...form, exercise })} />,
        )}
        {row(
          'side',
          'Side',
          <Select<Side> id={id('side')} value={form.side} options={SIDE_OPTIONS} onChange={(side) => setForm({ ...form, side })} />,
        )}
        {row('sets', 'Sets', <input id={id('sets')} className="input input-mono" type="number" min={1} max={10} value={form.sets} onChange={num('sets')} />)}
        {row('reps', 'Reps per set', <input id={id('reps')} className="input input-mono" type="number" min={1} max={50} value={form.reps} onChange={num('reps')} />)}
        {row('rest', 'Rest (seconds)', <input id={id('rest')} className="input input-mono" type="number" min={10} max={600} value={form.restSeconds} onChange={num('restSeconds')} />)}
        {row('goal', 'Goal (degrees)', <input id={id('goal')} className="input input-mono" type="number" min={0} max={180} value={form.targetDeg} onChange={num('targetDeg')} />)}
      </div>
      {error && (
        <div className="mt-4">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button className="btn btn-block" type="submit" disabled={saving}>
          <Lamp tone="primary" blink={saving} />
          {saving ? 'Saving…' : 'Save plan'}
        </button>
        {savedAt && !saving && (
          <span className="t-mono flex items-center gap-2 text-ok" role="status">
            <Lamp tone="good" /> OK · Saved.
          </span>
        )}
      </div>
    </form>
  )
}

function toForm(plan: PlanDto | null): PlanInput {
  if (plan) {
    const { exercise, side, sets, reps, restSeconds, targetDeg } = plan
    return { exercise, side, sets, reps, restSeconds, targetDeg }
  }
  const ex = EXERCISE_LIST[0]!
  return { exercise: ex.id, side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: ex.targetDeg }
}
