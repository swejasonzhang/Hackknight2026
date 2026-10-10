import { DELETE_CONFIRMATION, emailProblem, EMAIL_REQUIREMENT } from '@arc/dependencies'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { clearToken } from '../auth/token'
import { IconLogOut } from '../components/icons'
import { Page } from '../components/motion'
import { PasswordField } from '../components/PasswordField'
import { TextField } from '../components/TextField'
import { Alert, Avatar, PageHeader, Strip } from '../components/ui'

export const DELETED_NOTICE = 'Your account and everything in it were deleted.'

const confirmProblem = (value: string) => (value.trim() === DELETE_CONFIRMATION ? null : `Type ${DELETE_CONFIRMATION} exactly, in capital letters.`)

/**
 * The member's own sheet: who is signed in, log out, and the danger zone. Deleting needs the
 * account's email, its password and DELETE typed out; the server checks the credentials again
 * and removes every profile, session, plan and note with the account.
 */
export function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deleted = useRef(false)
  // Navigation is a transition, so signing out first would let the guard win and send the member
  // to /login. The session ends once the signed-in pages are actually gone.
  useEffect(
    () => () => {
      if (deleted.current) logout()
    },
    [logout],
  )
  if (!user) return null

  const emailRule = (value: string) => emailProblem(value) ?? (value.trim().toLowerCase() === user.email ? null : 'Use the email address on this account.')
  const valid = emailRule(email) === null && password.length > 0 && confirmProblem(confirm) === null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !valid) return
    setBusy(true)
    setError(null)
    try {
      await api.auth.deleteAccount({ email: email.trim(), password, confirm: DELETE_CONFIRMATION })
      deleted.current = true
      clearToken() // nothing else goes out with a token the server no longer honours
      navigate('/', { replace: true, state: { notice: DELETED_NOTICE } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Page className="max-w-[880px]">
      <PageHeader eyebrow="Account" title="Your account" subtitle="The details you signed up with, and the way out when you are done." />

      <Strip index="01" title="Signed in">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6">
          <Avatar name={user.name} size={56} />
          <dl className="grid min-w-0 gap-x-6 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-2 [&>dd]:mb-2 sm:[&>dd]:mb-0">
            <dt className="t-meta">Name</dt>
            <dd className="min-w-0 font-sans text-[16px] font-medium break-words text-ink">{user.name}</dd>
            <dt className="t-meta">Email</dt>
            <dd className="min-w-0 font-mono text-[13.5px] break-all text-ink-2">{user.email}</dd>
            <dt className="t-meta">Member since</dt>
            <dd className="font-mono text-[13.5px] text-ink-2">{joined}</dd>
          </dl>
          <button type="button" className="btn col-span-2 sm:col-span-1" onClick={logout}>
            <IconLogOut size={16} />
            Log out
          </button>
        </div>
      </Strip>

      <Strip index="02" title="Delete account" aside={<span className="text-bad">Permanent</span>}>
        <p className="t-desc max-w-[62ch] text-[14.5px]">
          This removes your account, every profile, every recorded session, your plans and everything Arc has said to you. It cannot be undone. Enter the email and password you log in
          with, then type {DELETE_CONFIRMATION} to confirm.
        </p>
        <form className="datasheet mt-5" onSubmit={submit} noValidate aria-busy={busy || undefined}>
          <TextField label="Email" type="email" value={email} onChange={setEmail} requirement={EMAIL_REQUIREMENT} problem={emailRule} autoComplete="email" />
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" ok={password.length > 0} />
          <TextField label={`Type ${DELETE_CONFIRMATION}`} value={confirm} onChange={setConfirm} requirement={`${DELETE_CONFIRMATION}, in capital letters.`} problem={confirmProblem} autoComplete="off" />

          {error && (
            <div className="my-4">
              <Alert tone="bad">{error}</Alert>
            </div>
          )}

          <div className="pt-5">
            <button className="btn btn-danger btn-block btn-lg w-full sm:w-auto" type="submit" disabled={busy || !valid}>
              {busy ? 'Deleting account…' : 'Delete account permanently'}
            </button>
          </div>
        </form>
      </Strip>
    </Page>
  )
}
