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
      <div className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Get started</div>
      <h2 className="text-[1.7rem] font-bold tracking-tight text-ink">Create your account</h2>
      <p className="mt-1.5 text-[15px] text-muted">One account per household. You'll add a profile for each person next.</p>
      <AuthForm mode="signup" onSubmit={onSubmit} />
      <p className="mt-5 text-[13px] text-muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </>
  )
}
