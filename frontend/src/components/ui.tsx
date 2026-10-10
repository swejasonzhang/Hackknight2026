import * as Tabs from '@radix-ui/react-tabs'
import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'

/*
 * Shared primitives of the "Calibre" system. Styling comes from the classes in index.css:
 * panels with registration marks, ruled strips and ledgers, lamps and mono tags.
 */

export type Tone = 'default' | 'good' | 'warn' | 'bad' | 'primary'

const lampTone: Record<Tone, string> = { default: 'lamp', primary: 'lamp lamp-on', good: 'lamp lamp-ok', warn: 'lamp lamp-warn', bad: 'lamp lamp-bad' }

/** An indicator lamp: grey off, cobalt on, or a status colour. */
export function Lamp({ tone = 'default', blink = false, className = '' }: { tone?: Tone; blink?: boolean; className?: string }) {
  return <span aria-hidden="true" className={`${lampTone[tone]} ${blink ? 'lamp-blink' : ''} ${className}`.trim()} />
}

/** A square mono tag such as DEMO or VIEWING. */
export function Tag({ children, soft = false, className = '' }: { children: ReactNode; soft?: boolean; className?: string }) {
  return <span className={`tag ${soft ? 'tag-soft' : ''} ${className}`.trim()}>{children}</span>
}

/** A paper panel with corner registration marks. With a title it opens with a strip head. */
export function Card({ children, className = '', title, subtitle, actions, index }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; index?: string }) {
  return (
    <section className={`panel p-5 sm:p-6 ${className}`.trim()}>
      {(title || actions) && (
        <header className="strip-head">
          {index && <span className="strip-index">{index}</span>}
          <div className="min-w-0">
            {title && <h2 className="t-strip">{title}</h2>}
            {subtitle && <p className="t-desc mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="strip-aside flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** A numbered, ruled section of a readout column: navy top rule, mono index, strip title. */
export function Strip({ index, title, aside, children, className = '', id }: { index: string; title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`strip ${className}`.trim()}>
      <header className="strip-head">
        <span className="strip-index">{index}</span>
        <h2 className="t-strip">{title}</h2>
        {aside && <div className="strip-aside t-meta">{aside}</div>}
      </header>
      {children}
    </section>
  )
}

/** One reading in a ledger of readouts: lamp, mono label with a hint, value at the right. */
export function StatTile({ label, value, hint, tone = 'default', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <div className="readout-row">
      <Lamp tone={tone} />
      <div className="min-w-0">
        <div className="t-label flex items-center gap-2">
          {icon && <span className="text-muted [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          {label}
        </div>
        {hint && <div className="t-desc mt-0.5">{hint}</div>}
      </div>
      <div className="t-value">{value}</div>
    </div>
  )
}

/** A ruled block announcing that there is nothing to read yet. */
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rule-strong grid gap-5 py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" role="status">
      <div>
        <div className="flex items-center gap-3">
          <Lamp />
          <span className="t-meta">No signal</span>
          {icon && <span className="hidden text-muted sm:inline-flex [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
        </div>
        <h2 className="t-display-sm mt-4 text-navy">{title}</h2>
        {description && <p className="t-lead mt-4 text-[16px]">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-3">{action}</div>}
    </div>
  )
}

/** The title block of a page: mono eyebrow, the title in Unbounded, a one-line description, actions at the right. */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end">
      <div className="min-w-0">
        {eyebrow && <div className="t-meta mb-3">{eyebrow}</div>}
        <h1 className="t-title">{title}</h1>
        {subtitle && <p className="t-desc mt-3 max-w-[60ch] text-[14.5px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 sm:justify-end">{actions}</div>}
    </header>
  )
}

/** A square initials tag; the top edge takes a blue hue derived from the name. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  const hue = 205 + (hash % 40)
  return (
    <span className="avatar-tag" style={{ width: size, height: size, fontSize: size * 0.36, ['--tag-hue' as string]: `hsl(${hue} 95% 55%)` }} aria-hidden="true">
      {initials || '?'}
    </span>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/** A selector switch: square cells on a rule, the active one navy with a cobalt top edge (Radix Tabs underneath). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: SegmentedOption<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  const layoutId = useId()
  return (
    <Tabs.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <Tabs.List aria-label={label} className="switch">
        {options.map((o) => {
          const active = o.value === value
          return (
            <Tabs.Trigger
              key={o.value}
              value={o.value}
              onClick={() => {
                if (!active) onChange(o.value)
              }}
              className="switch-cell"
            >
              {active && <motion.span layoutId={layoutId} aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-cobalt" transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} />}
              <span className="relative">{o.label}</span>
            </Tabs.Trigger>
          )
        })}
      </Tabs.List>
    </Tabs.Root>
  )
}

/** A hatched placeholder at the size of what is loading. */
export function Skeleton({ height = 16, width = '100%', className = '' }: { height?: number; width?: number | string; className?: string }) {
  return <div className={`hatch ${className}`.trim()} style={{ height, width }} aria-hidden="true" />
}

const alertTone: Record<Tone, { cls: string; tag: string }> = {
  default: { cls: 'alert-info', tag: 'NOTE' },
  primary: { cls: 'alert-info', tag: 'NOTE' },
  good: { cls: 'alert-ok', tag: 'OK' },
  warn: { cls: 'alert-warn', tag: 'NOTE' },
  bad: { cls: 'alert-bad', tag: 'ERR' },
}

/** A message strip with a coloured edge, a lamp and a mono tag. Errors are announced as alerts. */
export function Alert({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  const t = alertTone[tone]
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }} className={`alert-strip ${t.cls}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Lamp tone={tone === 'primary' ? 'primary' : tone} />
      <span className="t-mono font-medium tracking-[0.1em] text-ink-2">{t.tag}</span>
      <span className="min-w-0 flex-1 font-sans text-[14px] text-ink">{children}</span>
    </motion.div>
  )
}
