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
      <div className="eyebrow mb-2">Welcome back</div>
      <h2>Log in</h2>
      <p className="mt-2 text-[15px] text-muted">Pick up where you left off.</p>
      <AuthForm mode="login" onSubmit={onSubmit} />
      <p className="mt-6 text-[13.5px] font-semibold text-muted">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </>
  )
}
