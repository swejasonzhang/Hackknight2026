import { estimateFatigue, EXERCISES, EXERCISE_IDS, summarizeSets, type SetRecord, type SessionRecord } from '@ptg/dependencies'

/** Small deterministic PRNG so the demo dashboard looks the same on every machine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type DemoSession = Omit<SessionRecord, 'id'>

const DAY = 24 * 3600 * 1000
const WEEKS = 6
const SESSION_DAYS = [0, 2, 4] // Mon, Wed, Fri of each week

/**
 * Six weeks of three sessions a week for every exercise, trending upward with a little
 * noise, and reps inside each set that shrink a bit (fatigue) less and less as the weeks go by.
 */
export function generateDemoSessions(profileId: string, now = Date.now(), seed = 42): DemoSession[] {
  const rand = mulberry32(seed)
  const noise = (amp: number) => (rand() * 2 - 1) * amp
  const sessions: DemoSession[] = []

  // Monday of the current week, 18:00 UTC, then walk back WEEKS - 1 weeks.
  const today = new Date(now)
  const daysSinceMonday = (today.getUTCDay() + 6) % 7
  const thisMonday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysSinceMonday, 18)

  for (const exercise of EXERCISE_IDS) {
    const cfg = EXERCISES[exercise]
    const startPeak = cfg.targetDeg - 45
    for (let week = 0; week < WEEKS; week++) {
      const weekMonday = thisMonday - (WEEKS - 1 - week) * 7 * DAY
      for (const dayOffset of SESSION_DAYS) {
        const startedAt = weekMonday + dayOffset * DAY
        if (startedAt > now) continue
        const sessionPeak = startPeak + 6 * week + noise(3)
        const decayPerRep = Math.max(0.3, 1.5 - 0.15 * week)
        let t = startedAt + 5_000
        const sets: SetRecord[] = []
        for (let setNumber = 1; setNumber <= 3; setNumber++) {
          const setStart = t
          const reps = []
          for (let i = 0; i < 8; i++) {
            const durationMs = Math.round(2400 + 60 * i + noise(200))
            reps.push({
              index: i + 1,
              peakDeg: Math.round((sessionPeak - decayPerRep * i - 1.5 * (setNumber - 1) + noise(1.5)) * 10) / 10,
              startedAt: t,
              endedAt: t + durationMs,
              durationMs,
            })
            t += durationMs + 600
          }
          sets.push({ setNumber, reps, fatigue: estimateFatigue(reps), startedAt: setStart, endedAt: t - 600, endedEarly: false })
          t += 45_000
        }
        sessions.push({
          profileId,
          exercise,
          side: 'right',
          startedAt,
          endedAt: t,
          plan: { sets: 3, reps: 8, restSeconds: 45, targetDeg: cfg.targetDeg },
          sets,
          summary: summarizeSets(sets),
          demo: true,
        })
      }
    }
  }
  return sessions
}
