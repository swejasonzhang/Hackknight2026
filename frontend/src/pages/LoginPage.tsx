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
      <div className="eyebrow">Welcome back</div>
      <h2>Log in</h2>
      <p className="muted">Pick up where you left off.</p>
      <AuthForm mode="login" onSubmit={onSubmit} />
      <p className="muted small auth-switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </>
  )
}
