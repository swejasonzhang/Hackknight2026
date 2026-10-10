import { useId, useState, type FormEvent } from 'react'
import { Lamp } from './ui'
import { PasswordField } from './PasswordField'

export type AuthFormValues = { name?: string; email: string; password: string }

interface Props {
  mode: 'signup' | 'login'
  onSubmit: (values: AuthFormValues) => Promise<void>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Matches the API's SignupSchema (password min 8). */
export const MIN_PASSWORD = 8

type Field = 'name' | 'email' | 'password' | 'confirm'

/**
 * The account datasheet: ruled rows with a mono label and a status lamp in the left cell, the
 * control in the right cell, validation as mono lines tagged NOTE / ERR / OK, and the submit as
 * the sheet's last row, disabled until every field is valid.
 */
export function AuthForm({ mode, onSubmit }: Props) {
  const signup = mode === 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = { name: useId(), email: useId(), emailError: useId(), passwordHint: useId(), passwordError: useId(), confirmMsg: useId() }

  const nameOk = !signup || name.trim().length > 0
  const emailOk = EMAIL.test(email.trim())
  const passwordOk = signup ? password.length >= MIN_PASSWORD : password.length > 0
  const mismatch = signup && confirm.length > 0 && confirm !== password
  const matched = signup && confirm.length > 0 && confirm === password
  const confirmOk = !signup || matched
  const valid = nameOk && emailOk && passwordOk && confirmOk

  const touch = (field: Field) => setTouched((t) => ({ ...t, [field]: true }))
  const emailError = touched.email && email.length > 0 && !emailOk
  const passwordError = signup && touched.password && password.length > 0 && !passwordOk

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!valid) {
      setTouched({ name: true, email: true, password: true, confirm: true })
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(signup ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const label = busy ? (signup ? 'Creating account…' : 'Logging in…') : signup ? 'Create account' : 'Log in'
  const lampFor = (bad: boolean | undefined, ok: boolean, filled: boolean) => (bad ? 'lamp lamp-bad' : ok ? 'lamp lamp-ok' : filled ? 'lamp lamp-on' : 'lamp')

  return (
    <form className="datasheet" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      {signup && (
        <div className="field-row">
          <label htmlFor={ids.name} className="field-label">
            Name
            <span aria-hidden="true" className={lampFor(false, name.trim().length > 0, false)} />
          </label>
          <div className="field-cell">
            <input id={ids.name} className="input" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')} />
          </div>
        </div>
      )}

      <div className="field-row">
        <label htmlFor={ids.email} className="field-label">
          Email
          <span aria-hidden="true" className={lampFor(emailError, emailOk, email.length > 0)} />
        </label>
        <div className="field-cell">
          <input
            id={ids.email}
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => touch('email')}
            aria-invalid={emailError ? 'true' : undefined}
            aria-describedby={emailError ? ids.emailError : undefined}
          />
          {emailError && (
            <span id={ids.emailError} className="field-msg field-msg-bad" data-tag="ERR">
              Enter a valid email address.
            </span>
          )}
        </div>
      </div>

      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        onBlur={() => touch('password')}
        autoComplete={signup ? 'new-password' : 'current-password'}
        invalid={passwordError}
        ok={passwordOk && password.length > 0}
        describedBy={signup ? ids.passwordHint : undefined}
      >
        {signup && (
          <span id={ids.passwordHint} className={`field-msg ${passwordError ? 'field-msg-bad' : 'field-msg-note'}`} data-tag={passwordError ? 'ERR' : 'NOTE'}>
            At least {MIN_PASSWORD} characters.
          </span>
        )}
      </PasswordField>

      {signup && (
        <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} onBlur={() => touch('confirm')} autoComplete="new-password" invalid={mismatch} ok={matched} describedBy={mismatch || matched ? ids.confirmMsg : undefined}>
          <span id={ids.confirmMsg} className={`field-msg ${mismatch ? 'field-msg-bad' : matched ? 'field-msg-ok' : ''}`} data-tag={mismatch ? 'ERR' : matched ? 'OK' : undefined} aria-live="polite">
            {mismatch && 'Passwords do not match.'}
            {matched && 'Passwords match.'}
          </span>
        </PasswordField>
      )}

      {error && (
        <div className="alert-strip alert-bad my-4" role="alert">
          <Lamp tone="bad" />
          <span className="t-mono font-medium tracking-[0.1em] text-ink-2">ERR</span>
          <span className="min-w-0 flex-1 font-sans text-[14px] text-ink">{error}</span>
        </div>
      )}

      <div className="pt-5">
        <button className="btn btn-block btn-wide btn-lg" type="submit" disabled={busy || !valid}>
          <Lamp tone={busy ? 'primary' : valid ? 'primary' : 'default'} blink={busy} />
          {label}
        </button>
      </div>
    </form>
  )
}
