/* Icon set: Lucide, re-exported under the names the app already uses, plus the Arc logo mark. */
export {
  Activity as IconActivity,
  ArrowLeft as IconArrowLeft,
  ArrowRight as IconArrowRight,
  CalendarCheck as IconCalendar,
  Camera as IconCamera,
  Check as IconCheck,
  ChartLine as IconChart,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  Flame as IconFlame,
  LoaderCircle as IconSpinner,
  LogOut as IconLogOut,
  Plus as IconPlus,
  ShieldCheck as IconShield,
  Sparkles as IconSparkle,
  Target as IconTarget,
  Trash2 as IconTrash,
  TrendingUp as IconTrend,
  Users as IconUsers,
} from 'lucide-react'

export function Logo({ size = 28, tone = 'blue' }: { size?: number; tone?: 'blue' | 'white' }) {
  const tile = tone === 'white' ? '#ffffff' : 'var(--primary)'
  const arc = tone === 'white' ? 'var(--navy)' : '#ffffff'
  const dot = tone === 'white' ? 'var(--primary)' : 'var(--sky)'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="18" fill={tile} />
      <path d="M14 46a20 20 0 0 1 36 0" fill="none" stroke={arc} strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="46" r="5" fill={dot} />
    </svg>
  )
}
