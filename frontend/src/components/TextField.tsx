import { useId, useState } from 'react'

interface RuleOptions {
  value: string
  /** The shared rule from @arc/dependencies: null when the value passes, otherwise the reason. */
  problem: (value: string) => string | null
  /** An empty optional field passes; anything typed still has to meet the rule. */
  optional?: boolean
  /** Show the reason without waiting for the field to be left, after a submit attempt. */
  showErrors?: boolean
}

export interface FieldRule {
  /** The value fails and the member has had the chance to finish typing. */
  bad: boolean
  /** The value is filled in and passes. */
  ok: boolean
  /** The value passes (an empty optional field counts). */
  valid: boolean
  reason: string | null
  touch: () => void
  lamp: string
}

/** Tracks one field against its rule: quiet while typing, specific once the field is left. */
export function useFieldRule({ value, problem, optional = false, showErrors = false }: RuleOptions): FieldRule {
  const [touched, setTouched] = useState(false)
  const empty = value.trim().length === 0
  const reason = optional && empty ? null : problem(value)
  const bad = reason !== null && (showErrors || (touched && !empty))
  const ok = reason === null && !empty
  const lamp = bad ? 'lamp lamp-bad' : ok ? 'lamp lamp-ok' : empty ? 'lamp' : 'lamp lamp-on'
  return { bad, ok, valid: reason === null, reason, touch: () => setTouched(true), lamp }
}

/** The line under a field: the requirement (NOTE), the exact problem (ERR), or accepted (OK). */
export function FieldMessage({ id, rule, requirement, optional = false }: { id: string; rule: FieldRule; requirement: string; optional?: boolean }) {
  const tone = rule.bad ? 'field-msg-bad' : rule.ok ? 'field-msg-ok' : 'field-msg-note'
  return (
    <span id={id} className={`field-msg ${tone}`} data-tag={rule.bad ? 'ERR' : rule.ok ? 'OK' : 'NOTE'} aria-live="polite">
      {rule.bad ? rule.reason : optional ? `Optional. ${requirement}` : requirement}
    </span>
  )
}

interface Props extends RuleOptions {
  label: string
  onChange: (value: string) => void
  /** What the field accepts, shown under it from the start. */
  requirement: string
  type?: 'text' | 'email'
  autoComplete?: string
  placeholder?: string
}

/**
 * One datasheet row for a typed value: a mono label with a status lamp, the input, and the
 * requirement line under it. The rule is the one the API enforces, so the two never disagree.
 */
export function TextField({ label, value, onChange, requirement, problem, optional = false, showErrors = false, type = 'text', autoComplete, placeholder }: Props) {
  const id = useId()
  const msgId = useId()
  const rule = useFieldRule({ value, problem, optional, showErrors })
  return (
    <div className="field-row">
      <label htmlFor={id} className="field-label">
        {label}
        <span aria-hidden="true" className={rule.lamp} />
      </label>
      <div className="field-cell">
        <input
          id={id}
          className="input"
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={!optional}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={rule.touch}
          aria-invalid={rule.bad ? 'true' : undefined}
          aria-describedby={msgId}
        />
        <FieldMessage id={msgId} rule={rule} requirement={requirement} optional={optional} />
      </div>
    </div>
  )
}
