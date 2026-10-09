import type { ExerciseId, ProgressDto, SessionRecord } from '@arc/dependencies'

/** ISO date (YYYY-MM-DD) of the Monday that starts the UTC week containing `ms`. */
export function weekStartIso(ms: number): string {
  const d = new Date(ms)
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday)
  return new Date(monday).toISOString().slice(0, 10)
}

/** Pure aggregation behind GET /api/profiles/:id/progress. */
export function buildProgress(
  profileId: string,
  exercise: ExerciseId,
  sessions: readonly SessionRecord[],
  targetDeg: number | null,
): ProgressDto {
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt)

  const points = ordered.map((s) => ({
    sessionId: s.id,
    date: s.startedAt,
    bestPeakDeg: s.summary.bestPeakDeg,
    meanPeakDeg: s.summary.meanPeakDeg,
    fatigueIndex: s.summary.fatigueIndex,
    totalReps: s.summary.totalReps,
    demo: s.demo,
  }))

  const weeks = new Map<string, number>()
  for (const s of ordered) {
    const w = weekStartIso(s.startedAt)
    weeks.set(w, (weeks.get(w) ?? 0) + 1)
  }
  const sessionsPerWeek = [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, count]) => ({ weekStart, count }))

  const latest = ordered.at(-1)
  const latestSessionReps = latest
    ? latest.sets.flatMap((set) =>
        set.reps.map((r) => ({ label: `S${set.setNumber} R${r.index}`, setNumber: set.setNumber, index: r.index, peakDeg: r.peakDeg })),
      )
    : []

  return { profileId, exercise, targetDeg, sessions: points, sessionsPerWeek, latestSessionReps }
}
