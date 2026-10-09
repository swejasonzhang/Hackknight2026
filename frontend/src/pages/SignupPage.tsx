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
    <>
      <div className="eyebrow">Get started</div>
      <h2>Create your account</h2>
      <p className="muted">One account per household. You'll add a profile for each person next.</p>
      <AuthForm mode="signup" onSubmit={onSubmit} />
      <p className="muted small auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </>
  )
}
