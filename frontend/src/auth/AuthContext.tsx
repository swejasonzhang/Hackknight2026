import type { LoginInput, SignupInput, UserDto } from '@arc/dependencies'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { clearToken, getToken, setToken, SIGNED_OUT_EVENT } from './token'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthContextValue {
  user: UserDto | null
  status: AuthStatus
  signup: (input: SignupInput) => Promise<void>
  login: (input: LoginInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'signedOut'))

  // A stored token is only trusted once the API confirms it.
  useEffect(() => {
    if (!getToken()) return
    let cancelled = false
    api.auth
      .me()
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setStatus('signedIn')
      })
      .catch(() => {
        if (cancelled) return
        clearToken()
        setUser(null)
        setStatus('signedOut')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // The API client fires this when a request comes back 401.
  useEffect(() => {
    const onSignedOut = () => {
      setUser(null)
      setStatus('signedOut')
    }
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

  const accept = useCallback((res: { token: string; user: UserDto }) => {
    setToken(res.token)
    setUser(res.user)
    setStatus('signedIn')
  }, [])
  const signup = useCallback(async (input: SignupInput) => accept(await api.auth.signup(input)), [accept])
  const login = useCallback(async (input: LoginInput) => accept(await api.auth.login(input)), [accept])
  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('signedOut')
  }, [])

  const value = useMemo(() => ({ user, status, signup, login, logout }), [user, status, signup, login, logout])
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
