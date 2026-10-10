import { useId, useState } from 'react'

export type LoadUnit = 'kg' | 'lb'
const KG_PER_LB = 0.45359237
const UNIT_KEY = 'arc.loadUnit'

/** Kilograms from a value in `unit`, to the nearest 0.1 kg; null when blank or not a number. */
export function toKg(value: string, unit: LoadUnit): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(500, Math.round((unit === 'lb' ? n * KG_PER_LB : n) * 10) / 10)
}

/** A weight in kilograms as the member reads it in `unit`, to the nearest half. */
export function fromKg(kg: number, unit: LoadUnit): string {
  const v = unit === 'lb' ? kg / KG_PER_LB : kg
  return String(Math.round(v * 2) / 2)
}

function savedUnit(): LoadUnit {
  try {
    return localStorage.getItem(UNIT_KEY) === 'lb' ? 'lb' : 'kg'
  } catch {
    return 'kg'
  }
}

/**
 * The weight held for this recording, in kilograms or pounds (remembered per browser), stored in
 * kilograms with the session: 0 for bodyweight, blank when the member would rather not say. It
 * counts toward the household leaderboard's weight moved.
 */
export function LoadField({ initialKg, onChange }: { initialKg?: number | null; onChange: (kg: number | null) => void }) {
  const id = useId()
  const [unit, setUnit] = useState<LoadUnit>(savedUnit)
  const [value, setValue] = useState(initialKg != null ? fromKg(initialKg, savedUnit()) : '')

  const pickUnit = (next: LoadUnit) => {
    if (next === unit) return
    const kg = toKg(value, unit)
    setUnit(next)
    setValue(kg != null ? fromKg(kg, next) : value)
    try {
      localStorage.setItem(UNIT_KEY, next)
    } catch {
      /* per-viewer convenience only */
    }
  }

  return (
    <div className="mt-4 border-t border-rule pt-4">
      <label htmlFor={id} className="t-label">
        Weight held
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={id}
          className="input input-mono w-28"
          type="number"
          inputMode="decimal"
          min={0}
          step={unit === 'kg' ? 0.5 : 1}
          placeholder="0"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            onChange(toKg(e.target.value, unit))
          }}
        />
        <div role="group" aria-label="Unit" className="flex">
          {(['kg', 'lb'] as const).map((u) => (
            <button key={u} type="button" className="chip" aria-pressed={unit === u} onClick={() => pickUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <p className="t-meta mt-1.5 normal-case">Saved with the session (0 for bodyweight); it counts toward the leaderboard's weight moved.</p>
    </div>
  )
}
