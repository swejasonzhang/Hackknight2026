/* Icon set: Lucide, re-exported under the names the app uses, plus the Arc mark. */
export {
  Activity as IconActivity,
  ArrowLeft as IconArrowLeft,
  ArrowRight as IconArrowRight,
  CalendarCheck as IconCalendar,
  Camera as IconCamera,
  Check as IconCheck,
  ChartLine as IconChart,
  ChevronDown as IconChevronDown,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  Flame as IconFlame,
  LoaderCircle as IconSpinner,
  LogOut as IconLogOut,
  Plus as IconPlus,
  ShieldCheck as IconShield,
  Sparkles as IconSparkle,
  Target as IconTarget,
  Timer as IconTimer,
  Trash2 as IconTrash,
  TrendingUp as IconTrend,
  Users as IconUsers,
} from 'lucide-react'

/** The Arc mark: a square tile, an arc, a cobalt point. `tone="paper"` is for navy surfaces. */
export function Logo({ size = 28, tone = 'navy' }: { size?: number; tone?: 'navy' | 'paper' }) {
  const tile = tone === 'paper' ? '#ffffff' : '#0b1b3a'
  const arc = tone === 'paper' ? '#0b1b3a' : '#ffffff'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" fill={tile} />
      <path d="M14 46a18 18 0 0 1 36 0" fill="none" stroke={arc} strokeWidth="5" strokeLinecap="square" />
      <rect x="28" y="42" width="8" height="8" fill="#0b3dff" />
    </svg>
  )
}
