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
