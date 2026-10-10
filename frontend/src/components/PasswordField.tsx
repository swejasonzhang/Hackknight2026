import { useId, useState, type ReactNode } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete: 'new-password' | 'current-password'
  invalid?: boolean
  /** Green lamp when the value is accepted. */
  ok?: boolean
  /** ids of the message elements that describe this field */
  describedBy?: string
  children?: ReactNode
}

/**
 * One datasheet row: a mono label with a status lamp in the left cell, the masked input with
 * its own SHOW / HIDE control in the right cell. Toggling never touches the value.
 */
export function PasswordField({ label, value, onChange, onBlur, autoComplete, invalid, ok, describedBy, children }: Props) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const lamp = invalid ? 'lamp lamp-bad' : ok ? 'lamp lamp-ok' : value ? 'lamp lamp-on' : 'lamp'
  return (
    <div className="field-row">
      <label htmlFor={id} className="field-label">
        {label}
        <span aria-hidden="true" className={lamp} />
      </label>
      <div className="field-cell">
        <div className="field-input">
          <input
            id={id}
            className="input"
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            autoComplete={autoComplete}
            required
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={describedBy}
          />
          <button type="button" className="toggle" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
