import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthForm, type AuthFormValues } from '../components/AuthForm'

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/dashboard'

  const onSubmit = async (v: AuthFormValues) => {
    await signup({ name: v.name ?? '', email: v.email, password: v.password })
    navigate(from, { replace: true })
  }

  return (
    <>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="t-strip">Datasheet · new account</h2>
        <span className="t-meta">01 / 03</span>
      </div>
      <AuthForm mode="signup" onSubmit={onSubmit} />
      <p className="t-mono mt-6">
        Already have an account? <Link to="/login">Log in →</Link>
      </p>
    </>
  )
}
