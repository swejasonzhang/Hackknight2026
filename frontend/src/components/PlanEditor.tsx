import { EXERCISE_LIST, type ExerciseId, type PlanDto, type PlanInput, type Side } from '@ptg/dependencies'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'

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

  useEffect(() => {
    setForm(toForm(plan))
  }, [plan])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await api.plan.put(profileId, form))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save plan')
    } finally {
      setSaving(false)
    }
  }

  const num = (key: keyof PlanInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: Number(e.target.value) })

  return (
    <form className="card" onSubmit={submit}>
      <h3>Your plan {plan ? <span className="muted small">(saving replaces the current plan)</span> : null}</h3>
      <div className="grid-2">
        <label>
          Exercise
          <select value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value as ExerciseId })}>
            {EXERCISE_LIST.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Side
          <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as Side })}>
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </label>
        <label>
          Sets
          <input type="number" min={1} max={10} value={form.sets} onChange={num('sets')} />
        </label>
        <label>
          Reps per set
          <input type="number" min={1} max={50} value={form.reps} onChange={num('reps')} />
        </label>
        <label>
          Rest (seconds)
          <input type="number" min={10} max={600} value={form.restSeconds} onChange={num('restSeconds')} />
        </label>
        <label>
          Goal (degrees)
          <input type="number" min={0} max={180} value={form.targetDeg} onChange={num('targetDeg')} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save plan'}
      </button>
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
