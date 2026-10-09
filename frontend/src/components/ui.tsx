import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'

/* Small presentational building blocks shared by every page. */

export function Card({ children, className = '', title, subtitle, actions }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export type Tone = 'default' | 'good' | 'warn' | 'bad' | 'primary'

const bar: Record<Tone, string> = { default: 'border-t-line-strong', good: 'border-t-good', warn: 'border-t-warn', bad: 'border-t-bad', primary: 'border-t-primary' }

export function StatTile({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className={`relative rounded-sm border border-line border-t-[3px] bg-surface p-5 shadow-card ${bar[tone]}`}>
      <div className="font-display text-[12px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</div>
      <div className="mt-2 font-display text-[2.4rem] leading-none font-extrabold tracking-tight text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-line-strong bg-surface px-6 py-12 text-center" role="status">
      {icon && <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-sm bg-primary-soft text-primary">{icon}</div>}
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-[52ch] text-[14px] text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 font-display text-[12px] font-bold tracking-[0.16em] text-primary uppercase">{eyebrow}</div>}
        <h1 className="text-[2.4rem] leading-none text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  )
}

/** Initials on a hue derived from the name, so each person gets a stable colour. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-sm font-display font-bold ring-1 ring-line-strong"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hash} 45% 18%)`, color: `hsl(${hash} 70% 78%)` }}
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

/** Tabs with a pill that slides to the active option. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: SegmentedOption<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  const layoutId = useId()
  return (
    <div className="inline-flex rounded-sm border border-line-strong bg-surface-2 p-0.5" role="tablist" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative cursor-pointer rounded-sm px-3.5 py-1.5 font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-2 ${active ? 'text-white' : 'text-muted hover:text-ink'}`}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-sm bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
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
  primary: 'border-transparent bg-primary-soft text-primary',
  good: 'border-transparent bg-good-soft text-good',
  warn: 'border-transparent bg-warn-soft text-warn',
  bad: 'border-transparent bg-bad-soft text-bad',
}

export function Alert({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`rounded-sm border px-3.5 py-2.5 text-[14px] ${alertTone[tone]}`} role={tone === 'bad' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
