import { useId, useState, type FormEvent } from 'react'
import { IconCheck } from './icons'
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

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
      {signup && (
        <div className="field">
          <label htmlFor={ids.name}>Name</label>
          <input id={ids.name} className="input" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')} />
        </div>
      )}

      <div className="field">
        <label htmlFor={ids.email}>Email</label>
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
          <span id={ids.emailError} className="field-msg field-msg-bad">
            Enter a valid email address.
          </span>
        )}
      </div>

      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        onBlur={() => touch('password')}
        autoComplete={signup ? 'new-password' : 'current-password'}
        invalid={passwordError}
        describedBy={signup ? ids.passwordHint : undefined}
      >
        {signup && (
          <span id={ids.passwordHint} className={`field-msg ${passwordError ? 'field-msg-bad' : ''}`}>
            At least {MIN_PASSWORD} characters.
          </span>
        )}
      </PasswordField>

      {signup && (
        <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} onBlur={() => touch('confirm')} autoComplete="new-password" invalid={mismatch} describedBy={mismatch || matched ? ids.confirmMsg : undefined}>
          <span id={ids.confirmMsg} className={`field-msg ${mismatch ? 'field-msg-bad' : matched ? 'field-msg-good' : ''}`} aria-live="polite">
            {mismatch && 'Passwords do not match.'}
            {matched && (
              <>
                <IconCheck width={14} height={14} /> Passwords match.
              </>
            )}
          </span>
        </PasswordField>
      )}

      {error && (
        <p className="field-msg field-msg-bad text-[14px]" role="alert">
          {error}
        </p>
      )}

      <button className="btn btn-primary mt-1 w-full py-3" type="submit" disabled={busy || !valid} aria-busy={busy || undefined}>
        {label}
      </button>
    </form>
  )
}
