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
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  Flame as IconFlame,
  LoaderCircle as IconSpinner,
  LogOut as IconLogOut,
  Mic as IconMic,
  Plus as IconPlus,
  SendHorizontal as IconSend,
  ShieldCheck as IconShield,
  Sparkles as IconSparkle,
  Target as IconTarget,
  Timer as IconTimer,
  Trash2 as IconTrash,
  TrendingUp as IconTrend,
  Users as IconUsers,
  Volume2 as IconVolume,
  VolumeX as IconVolumeOff,
} from 'lucide-react'

// The ARC wordmark: heavy, slanted letters; the A a solid triangle whose foot is an arrow driving on.
const A_BODY = 'M98 0L170 112L84 112L60 148L0 148ZM99 52L82 84L118 84Z'
const A_FOOT = 'M92 122L176 122L172 116L206 146L162 172L168 160L68 160Z'
const R = 'M214 22L318 22Q342 22 336 46L330 68Q324 90 300 90L290 90L314 160L276 160L254 90L240 90L216 160L178 160ZM236 48L228 70L290 70Q298 70 301 62L303 56Q305 48 297 48Z'
const C = 'M352 22L470 22L452 54L374 54Q364 54 361 64L351 114Q349 128 362 128L420 128L402 160L338 160Q304 160 311 126L322 58Q328 22 352 22Z'

/**
 * The Arc logo: the ARC wordmark, or (`mark`) its A alone for a square spot. `height` sets its size,
 * the width follows. `tone="paper"` is for navy surfaces. With a `label` it is an image of that name;
 * without one it is decoration beside the name a link already gives.
 */
export function Logo({ height = 24, tone = 'navy', mark = false, label }: { height?: number; tone?: 'navy' | 'paper'; mark?: boolean; label?: string }) {
  const fill = tone === 'paper' ? '#ffffff' : '#0b1b3a'
  const box = mark ? { x: -2, y: -2, w: 212, h: 178 } : { x: -2, y: -2, w: 476, h: 178 }
  return (
    <svg
      height={height}
      width={(height * box.w) / box.h}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      className="shrink-0"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <g fill={fill}>
        <path fillRule="evenodd" d={A_BODY} />
        <path d={A_FOOT} />
        {!mark && (
          <>
            <path fillRule="evenodd" d={R} />
            <path d={C} />
          </>
        )}
      </g>
    </svg>
  )
}
