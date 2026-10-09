import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthForm, type AuthFormValues } from '../components/AuthForm'

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'

  const onSubmit = async (v: AuthFormValues) => {
    await signup({ name: v.name ?? '', email: v.email, password: v.password })
    navigate(from, { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Create your account</h2>
        <p className="muted">One account per household. Add a profile for each person who exercises.</p>
        <AuthForm mode="signup" onSubmit={onSubmit} />
        <p className="muted small">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
