export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function deg(x: number | null | undefined, digits = 0): string {
  return x == null || Number.isNaN(x) ? '–' : `${x.toFixed(digits)}°`
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

/** ISO date of the Monday starting the UTC week that contains `ms`; matches the server's weekStartIso. */
export function weekStartIso(ms: number): string {
  const d = new Date(ms)
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday)).toISOString().slice(0, 10)
}

/** Plain-language reading of the fatigue proxy. */
export function fatigueLabel(index: number): { text: string; tone: 'good' | 'warn' | 'bad' } {
  if (index >= 0.25) return { text: 'range collapsed late in a set', tone: 'bad' }
  if (index >= 0.12) return { text: 'range shrank late in sets', tone: 'warn' }
  return { text: 'steady across each set', tone: 'good' }
}
