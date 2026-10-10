import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthForm, type AuthFormValues } from '../components/AuthForm'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/dashboard'

  const onSubmit = async (v: AuthFormValues) => {
    await login({ email: v.email, password: v.password })
    navigate(from, { replace: true })
  }

  return (
    <>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="t-strip">Datasheet · account</h2>
        <span className="t-meta">01 / 01</span>
      </div>
      <AuthForm mode="login" onSubmit={onSubmit} />
      <p className="t-mono mt-6">
        New here? <Link to="/signup">Create an account →</Link>
      </p>
    </>
  )
}
