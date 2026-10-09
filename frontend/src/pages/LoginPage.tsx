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
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Welcome back</h2>
        <AuthForm mode="login" onSubmit={onSubmit} />
        <p className="muted small">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
