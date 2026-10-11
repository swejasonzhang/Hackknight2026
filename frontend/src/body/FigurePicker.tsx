import type { Figure } from '@arc/dependencies'

const OPTIONS: { value: Figure | null; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: null, label: 'Either' },
]

/**
 * Which body the figure is drawn as: female, male, or between the two (a profile that has not
 * picked). Chips, like the leaderboard's, so a tap changes it.
 */
export function FigurePicker({ value, onChange, disabled = false }: { value: Figure | null; onChange: (figure: Figure | null) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Figure" className="flex flex-wrap items-center gap-2">
      <span className="t-label">Figure</span>
      {OPTIONS.map((o) => (
        <button key={o.label} type="button" className="chip" aria-pressed={value === o.value} disabled={disabled} onClick={() => value !== o.value && onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
