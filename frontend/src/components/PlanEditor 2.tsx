import { EXERCISE_LIST, type ExerciseId, type PlanDto, type PlanInput, type Side } from '@arc/dependencies'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { api } from '../api/client'
import { Card } from './ui'

interface Props {
  profileId: string
  plan: PlanDto | null
  onSaved: (plan: PlanDto) => void
}

/** Set or replace the profile's plan: sets, reps, rest and the goal angle. */
export function PlanEditor({ profileId, plan, onSaved }: Props) {
  const [form, setForm] = useState<PlanInput>(toForm(plan))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

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

  return (
    <Card title="Your plan" subtitle={plan ? 'The camera app reads this to know your sets, reps and goal.' : 'No plan yet. Save one so the camera app knows what to count.'}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Exercise
            <select className="input" value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value as ExerciseId })}>
              {EXERCISE_LIST.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Side
            <select className="input" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as Side })}>
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </label>
          <label className="field">
            Sets
            <input className="input" type="number" min={1} max={10} value={form.sets} onChange={num('sets')} />
          </label>
          <label className="field">
            Reps per set
            <input className="input" type="number" min={1} max={50} value={form.reps} onChange={num('reps')} />
          </label>
          <label className="field">
            Rest (seconds)
            <input className="input" type="number" min={10} max={600} value={form.restSeconds} onChange={num('restSeconds')} />
          </label>
          <label className="field">
            Goal (degrees)
            <input className="input" type="number" min={0} max={180} value={form.targetDeg} onChange={num('targetDeg')} />
          </label>
        </div>
        {error && <p className="text-[14px] text-bad">{error}</p>}
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save plan'}
          </button>
          {savedAt && !saving && <span className="text-[13px] text-good">Saved.</span>}
        </div>
      </form>
    </Card>
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
