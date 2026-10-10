import { estimateFatigue, EXERCISES, EXERCISE_IDS, summarizeSets, type SetRecord, type SessionRecord } from '@arc/dependencies'

/** Small seeded PRNG: random-looking data that a seed reproduces exactly (tests pass a fixed seed). */
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
/** Start times people actually train at, UTC. */
const HOURS = [7, 8, 12, 17, 18, 19, 20]

/**
 * Six weeks of believable practice for every exercise, different for every seed: each exercise
 * starts 32 to 52 degrees short of its goal and gains 3.5 to 7 degrees a week; two or three
 * sessions a week on random days (Monday to Saturday) and times; reps fade within a set less as
 * the weeks go by; about one session in eight is an off day with lower range, more fatigue and
 * sometimes a last set ended early. The same seed always gives the same data.
 */
export function generateDemoSessions(profileId: string, now = Date.now(), seed = 42): DemoSession[] {
  const rand = mulberry32(seed)
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
  const noise = (amp: number) => (rand() * 2 - 1) * amp
  const sessions: DemoSession[] = []

  // Monday 00:00 UTC of the current week, then walk back WEEKS - 1 weeks.
  const today = new Date(now)
  const daysSinceMonday = (today.getUTCDay() + 6) % 7
  const thisMonday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysSinceMonday)

  for (const exercise of EXERCISE_IDS) {
    const cfg = EXERCISES[exercise]
    const gap = between(32, 52)
    const gain = between(3.5, 7)
    const steadiness = between(0.7, 1.3)
    for (let week = 0; week < WEEKS; week++) {
      const weekMonday = thisMonday - (WEEKS - 1 - week) * 7 * DAY
      const days = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5).slice(0, rand() < 0.4 ? 2 : 3).sort((a, b) => a - b)
      for (const day of days) {
        const hour = HOURS[Math.floor(rand() * HOURS.length)]!
        const startedAt = weekMonday + day * DAY + hour * 3_600_000 + Math.floor(rand() * 4) * 15 * 60_000
        if (startedAt > now) continue
        const offDay = rand() < 0.12
        const sessionPeak = cfg.targetDeg - gap + gain * week + noise(2.5) - (offDay ? between(4, 9) : 0)
        const decayPerRep = Math.max(0.25, (1.6 - 0.18 * week) * steadiness) * (offDay ? 1.8 : 1)
        let t = startedAt + 5_000
        const sets: SetRecord[] = []
        for (let setNumber = 1; setNumber <= 3; setNumber++) {
          const endedEarly = offDay && setNumber === 3 && rand() < 0.6
          const count = endedEarly ? 5 : 8
          const setStart = t
          const reps = []
          for (let i = 0; i < count; i++) {
            const durationMs = Math.round(2400 + 60 * i * (offDay ? 1.6 : 1) + noise(200))
            const peak = sessionPeak - decayPerRep * i - 1.5 * (setNumber - 1) + noise(1.5)
            reps.push({ index: i + 1, peakDeg: Math.round(Math.min(179, peak) * 10) / 10, startedAt: t, endedAt: t + durationMs, durationMs })
            t += durationMs + 600
          }
          sets.push({ setNumber, reps, fatigue: estimateFatigue(reps), startedAt: setStart, endedAt: t - 600, endedEarly })
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
