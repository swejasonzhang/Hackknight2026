import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthForm, type AuthFormValues } from '../components/AuthForm'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'

  const onSubmit = async (v: AuthFormValues) => {
    await login({ email: v.email, password: v.password })
    navigate(from, { replace: true })
  }

  return (
    <>
      <div className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Welcome back</div>
      <h2 className="text-[1.7rem] font-bold tracking-tight text-ink">Log in</h2>
      <p className="mt-1.5 text-[15px] text-muted">Pick up where you left off.</p>
      <AuthForm mode="login" onSubmit={onSubmit} />
      <p className="mt-5 text-[13px] text-muted">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </>
  )
}
