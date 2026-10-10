import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'

/* Shared presentational building blocks. Styling comes from the classes in index.css plus a few utilities. */

export function Card({ children, className = '', title, subtitle, actions }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h3>{title}</h3>}
            {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export type Tone = 'default' | 'good' | 'warn' | 'bad' | 'primary'

const badge: Record<Tone, string> = {
  default: 'bg-surface-2 text-ink-2',
  primary: 'bg-primary-soft text-primary',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
}

export function StatTile({ label, value, hint, tone = 'default', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <div className="card relative flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11.5px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</div>
        {icon && <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badge[tone]}`}>{icon}</div>}
      </div>
      <div className="text-[2.5rem] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">{value}</div>
      {hint && <div className="text-[13px] text-muted">{hint}</div>}
    </div>
  )
}

function EmptyArc() {
  return (
    <svg width="120" height="72" viewBox="0 0 120 72" aria-hidden="true">
      <path d="M12 64a48 48 0 0 1 96 0" fill="none" stroke="var(--line-strong)" strokeWidth="8" strokeLinecap="round" />
      <path d="M12 64a48 48 0 0 1 58 -46" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="70" cy="18" r="6" fill="var(--surface)" stroke="var(--primary)" strokeWidth="4" />
    </svg>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center" role="status">
      <div className="mb-4 text-primary">{icon ?? <EmptyArc />}</div>
      <h3 className="text-[22px] font-light">{title}</h3>
      {description && <p className="mt-2 max-w-[52ch] text-[14.5px] text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="mt-2 max-w-[60ch] text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  )
}

/** Initials on a blue-family tint derived from the name, so each person gets a stable colour. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  const hue = 190 + (hash % 50) // blues only
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 90% 50% / 0.18)`, color: `hsl(${hue} 100% 72%)`, boxShadow: `0 0 0 1px hsl(${hue} 90% 55% / 0.45)` }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/** Tabs with a blue pill that slides to the active option. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: SegmentedOption<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  const layoutId = useId()
  return (
    <div className="inline-flex rounded-full border border-line-strong bg-surface p-1" role="tablist" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative cursor-pointer rounded-full px-4 py-2 text-[13px] font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-primary/40 focus-visible:outline-none ${active ? 'text-white' : 'text-muted hover:text-ink'}`}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-primary shadow-blue" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative z-10">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%', className = '' }: { height?: number; width?: number | string; className?: string }) {
  return <div className={`skeleton ${className}`.trim()} style={{ height, width }} aria-hidden="true" />
}

const alertTone: Record<Tone, string> = {
  default: 'border-line bg-surface-2 text-ink-2',
  primary: 'border-primary/40 bg-primary-soft text-primary',
  good: 'border-good/40 bg-good-soft text-good',
  warn: 'border-warn/40 bg-warn-soft text-warn',
  bad: 'border-bad/40 bg-bad-soft text-bad',
}

export function Alert({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[14px] border px-4 py-3 text-[14px] font-medium ${alertTone[tone]}`} role={tone === 'bad' ? 'alert' : 'status'}>
      {children}
    </motion.div>
  )
}
