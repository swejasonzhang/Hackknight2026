import { Outlet } from 'react-router-dom'
import { APP_NAME, TAGLINE } from '../brand'
import { Logo } from '../components/icons'

function HeroArc() {
  // A decorative goniometer arc with degree ticks and a "current angle" marker.
  const ticks = Array.from({ length: 7 }, (_, i) => i * 30) // 0..180
  const cx = 160
  const cy = 170
  const r = 130
  const pt = (deg: number, radius: number) => {
    const a = Math.PI - (deg * Math.PI) / 180
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) }
  }
  const marker = pt(132, r)
  const sweep = `M ${pt(0, r).x} ${pt(0, r).y} A ${r} ${r} 0 0 1 ${marker.x} ${marker.y}`
  return (
    <svg className="hero-arc" viewBox="0 0 320 200" role="img" aria-label="Arc showing 132 degrees of range of motion against a 140 degree goal">
      <path d={`M ${pt(0, r).x} ${pt(0, r).y} A ${r} ${r} 0 0 1 ${pt(180, r).x} ${pt(180, r).y}`} fill="none" stroke="var(--border-strong)" strokeWidth="10" strokeLinecap="round" />
      <path d={sweep} fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" />
      {ticks.map((t) => {
        const a = pt(t, r + 18)
        return (
          <text key={t} x={a.x} y={a.y + 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {t}°
          </text>
        )
      })}
      {(() => {
        const g = pt(140, r)
        const g2 = pt(140, r - 22)
        return <line x1={g.x} y1={g.y} x2={g2.x} y2={g2.y} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      })()}
      <circle cx={marker.x} cy={marker.y} r="9" fill="var(--surface)" stroke="var(--primary)" strokeWidth="4" />
      <text x={cx} y={cy - 24} textAnchor="middle" fontSize="40" fontWeight="800" fill="var(--ink)">
        132°
      </text>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="12" fill="var(--muted)">
        elbow flexion · goal 140°
      </text>
    </svg>
  )
}

/** Front door for visitors: the pitch on the left, the sign-up or login card on the right. */
export function AuthLayout() {
  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="brand brand-lg">
          <Logo size={36} />
          <span>{APP_NAME}</span>
        </div>
        <h1>{TAGLINE}</h1>
        <p className="lead">
          A camera app measures every rep in degrees, like a goniometer that lives in your laptop. This is where you watch the trend: peak range, fading range within a set, and how
          consistently you show up. For anyone in the household, at any age.
        </p>
        <HeroArc />
        <ol className="steps">
          <li>
            <strong>Create an account</strong> and add a profile for each person who exercises.
          </li>
          <li>
            <strong>Exercise in front of the camera app.</strong> It counts reps and sets and stores the session.
          </li>
          <li>
            <strong>Watch the dashboard.</strong> Goal lines, rep-by-rep detail, fatigue proxy, sessions per week.
          </li>
        </ol>
        <ul className="chips" aria-label="Highlights">
          <li>Elbow, shoulder, knee</li>
          <li>Degrees, not guesses</li>
          <li>Household profiles</li>
          <li>Private by default</li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <Outlet />
        </div>
      </section>
    </div>
  )
}
