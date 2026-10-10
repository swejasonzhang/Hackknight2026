/* Icon set: Lucide, re-exported under the names the app already uses, plus the Arc logo mark. */
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

/** The Arc mark: a glowing blue arc on a dark tile. `tone="light"` is for white sections. */
export function Logo({ size = 28, tone = 'dark', glow = true }: { size?: number; tone?: 'dark' | 'light'; glow?: boolean }) {
  const tile = tone === 'light' ? '#26262b' : '#0a0a0c'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="shrink-0"
      style={glow ? { filter: 'drop-shadow(0 0 6px rgb(0 161 255 / 0.65))' } : undefined}
    >
      <rect width="64" height="64" rx="18" fill={tile} stroke="rgb(0 161 255 / 0.55)" strokeWidth="2" />
      <path d="M14 46a20 20 0 0 1 36 0" fill="none" stroke="#00a1ff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="46" r="5" fill="#ffffff" />
    </svg>
  )
}
