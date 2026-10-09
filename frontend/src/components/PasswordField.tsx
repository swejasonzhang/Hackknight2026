import { useId, useState, type ReactNode } from 'react'
import { IconEye, IconEyeOff } from './icons'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete: 'new-password' | 'current-password'
  invalid?: boolean
  /** ids of the message elements that describe this field */
  describedBy?: string
  children?: ReactNode
}

/** Masked input with its own show/hide control. Toggling never touches the value. */
export function PasswordField({ label, value, onChange, onBlur, autoComplete, invalid, describedBy, children }: Props) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          className="input pr-12"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          required
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        <button type="button" className="eye" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
      {children}
    </div>
  )
}
