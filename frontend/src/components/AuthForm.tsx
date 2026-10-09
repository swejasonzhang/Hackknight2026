import { useState, type FormEvent } from 'react'

export type AuthFormValues = { name?: string; email: string; password: string }

interface Props {
  mode: 'signup' | 'login'
  onSubmit: (values: AuthFormValues) => Promise<void>
}

export function AuthForm({ mode, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(mode === 'signup' ? { name, email, password } : { email, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
      {mode === 'signup' && (
        <label className="field">
          Name
          <input className="input" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <label className="field">
        Email
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        Password
        <input
          className="input"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={mode === 'signup' ? 8 : 1}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === 'signup' && <span className="text-[12px] font-normal text-muted">At least 8 characters.</span>}
      </label>
      {error && (
        <p className="text-[14px] text-bad" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary mt-1 w-full py-2.5" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
    </form>
  )
}
