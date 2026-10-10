import type { LeaderboardDto, LeaderboardMetric, LeaderboardRow, LeaderboardWindow } from '@arc/dependencies'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ease } from '../components/motion'
import { Alert, Avatar, Lamp, Skeleton, Strip, Tag } from '../components/ui'

const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: '30 days' },
  { id: 'all', label: 'All time' },
]
const METRICS: { id: LeaderboardMetric; label: string }[] = [
  { id: 'score', label: 'Arc score' },
  { id: 'reps', label: 'Reps' },
  { id: 'sets', label: 'Sets' },
  { id: 'volume', label: 'Weight' },
  { id: 'steadiness', label: 'Fatigue' },
]
const FACTOR_WORDS: Record<LeaderboardDto['factors'][number], string> = { reps: 'reps', sets: 'sets', volume: 'weight moved', steadiness: 'steadiness (low fatigue)' }
const ORDINAL = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`

/** The figure a row is ranked on, as a number for the bar and as words. */
function measure(row: LeaderboardRow, metric: LeaderboardMetric): { value: number; text: string } {
  switch (metric) {
    case 'score':
      return { value: row.score, text: `${row.score}` }
    case 'reps':
      return { value: row.reps, text: `${row.reps} reps` }
    case 'sets':
      return { value: row.sets, text: `${row.sets} sets` }
    case 'volume':
      return { value: row.volumeKg, text: `${row.volumeKg.toLocaleString()} kg` }
    case 'steadiness':
      return { value: row.steadiness ?? 0, text: row.fatigue == null ? 'not measured' : `fatigue ${row.fatigue.toFixed(2)}` }
  }
}

/**
 * The household leaderboard (ADR-0027): everyone on the account ranked on the window's training,
 * by an Arc score that factors in reps, sets, weight moved and steadiness, or by any one of them
 * (fatigue ranks the steadiest first). The profile being viewed carries the cobalt edge.
 */
export function Leaderboard({ selectedId, refresh = 0, className = '' }: { selectedId: string; refresh?: number; className?: string }) {
  const [window, setWindow] = useState<LeaderboardWindow>('week')
  const [metric, setMetric] = useState<LeaderboardMetric>('score')
  const [board, setBoard] = useState<LeaderboardDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    api
      .leaderboard(window)
      .then((b) => !cancelled && setBoard(b))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the leaderboard'))
    return () => {
      cancelled = true
    }
  }, [window, refresh])

  const anyone = board?.rows.some((r) => r.sessions > 0) ?? false

  return (
    <Strip index="01" title="Who moved most" aside="Your household, ranked" className={className}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="When" className="flex flex-wrap gap-2">
            {WINDOWS.map((w) => (
              <button key={w.id} type="button" className="chip" aria-pressed={window === w.id} onClick={() => setWindow(w.id)}>
                {w.label}
              </button>
            ))}
          </div>
          <MetricChips value={metric} onChange={setMetric} />
        </div>
        {board && (
          <p className="t-meta mt-3 normal-case">
            Arc score: {board.factors.map((f) => FACTOR_WORDS[f]).join(', ')}, each against the best here, averaged to 100.
            {!board.factors.includes('volume') && ' Weight moved joins once someone records a weight.'} Only the profiles on this account are compared.
          </p>
        )}

        {error && (
          <div className="mt-4">
            <Alert tone="bad">{error}</Alert>
          </div>
        )}
        {!board && !error && <Skeleton height={180} className="mt-4" />}
        {board && !anyone && (
          <p className="t-desc mt-4">No training {window === 'week' ? 'this week' : window === 'month' ? 'in the last 30 days' : 'yet'}. Record a session to get on the board.</p>
        )}
        {board && anyone && <BoardRows board={board} metric={metric} selectedId={selectedId} />}
      </div>
    </Strip>
  )
}

/** The chips that pick what the board ranks on. */
export function MetricChips({ value, onChange }: { value: LeaderboardMetric; onChange: (m: LeaderboardMetric) => void }) {
  return (
    <div role="group" aria-label="Rank by" className="flex flex-wrap gap-2">
      {METRICS.map((m) => (
        <button key={m.id} type="button" className="chip" aria-pressed={value === m.id} onClick={() => onChange(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  )
}

/** The ranked rows: place, who, what they did, and the ranked figure as a bar against the best. */
export function BoardRows({ board, metric, selectedId }: { board: LeaderboardDto; metric: LeaderboardMetric; selectedId?: string }) {
  const reduce = useReducedMotion()
  const rows = [...board.rows].sort((a, b) => a.ranks[metric] - b.ranks[metric] || a.name.localeCompare(b.name))
  const best = Math.max(0, ...rows.map((r) => measure(r, metric).value))
  return (
    <ol className="mt-4 border-t border-rule-strong" aria-label={`Ranked by ${METRICS.find((m) => m.id === metric)!.label.toLowerCase()}`}>
      {rows.map((row, i) => {
        const place = row.ranks[metric]
        const m = measure(row, metric)
        const viewing = row.profileId === selectedId
        return (
          <motion.li
            key={row.profileId}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease, delay: 0.04 * i }}
            className={`grid grid-cols-[52px_36px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-rule py-3 sm:grid-cols-[56px_36px_minmax(0,1fr)_minmax(0,1.2fr)] ${viewing ? 'shadow-[inset_3px_0_0_var(--cobalt)]' : ''}`}
            aria-label={`${ORDINAL(place)}: ${row.name}, ${m.text}${metric === 'score' ? ' Arc score' : ''}`}
          >
            <span className={`pl-3 font-display text-[18px] leading-none sm:text-[22px] font-semibold tabular-nums ${place === 1 && row.sessions > 0 ? 'text-cobalt' : 'text-navy'}`}>{ORDINAL(place)}</span>
            <Avatar name={row.name} size={36} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[15px] font-medium text-ink">{row.name}</span>
                {viewing && (
                  <span className="t-meta flex items-center gap-1.5 text-cobalt">
                    <Lamp tone="primary" /> Viewing
                  </span>
                )}
                {row.demo && <Tag soft>Demo</Tag>}
              </div>
              <div className="t-meta mt-0.5 normal-case">
                {row.sessions === 0
                  ? 'No training in this window'
                  : `${row.reps} reps · ${row.sets} sets · ${row.volumeKg.toLocaleString()} kg moved${row.topLoadKg ? ` (top ${row.topLoadKg} kg)` : ''} · ${row.fatigue == null ? 'fatigue not measured' : `fatigue ${row.fatigue.toFixed(2)}`}`}
              </div>
            </div>
            {/* The ranked figure as a bar against the best here. */}
            <div className="col-span-3 flex items-center gap-3 pl-3 sm:col-span-1 sm:pl-0">
              <div className="relative h-2 flex-1 bg-vellum" aria-hidden="true">
                <motion.span className="absolute inset-y-0 left-0 bg-cobalt" initial={reduce ? false : { width: 0 }} animate={{ width: `${best ? (100 * m.value) / best : 0}%` }} transition={{ duration: 0.6, ease }} />
              </div>
              <span className="w-[112px] flex-none text-right font-mono text-[13px] tabular-nums text-ink">{metric === 'score' ? `${m.text} / 100` : m.text}</span>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
