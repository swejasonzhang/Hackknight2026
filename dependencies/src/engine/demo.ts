import { EXERCISES } from './exercises.ts'
import { estimateFatigue } from './fatigue.ts'
import { summarizeSets } from './summary.ts'
import { EXERCISE_IDS, type ExerciseId, type SessionRecord, type SetRecord } from './types.ts'

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
/** Start times people actually train at, on the viewer's own clock. */
const HOURS = [7, 8, 12, 17, 18, 19, 20]

/**
 * The weight a demo member holds for each movement in week one and how much it rises a week, in
 * kilograms: dumbbells for the arm and shoulder work, a cable or band for the pulldown, a bar for
 * the deadlift, a goblet squat and a medicine-ball twist; lunges, the seated knee extension and
 * crunches are bodyweight (0).
 */
const DEMO_LOAD: Record<ExerciseId, [number, number]> = {
  elbow_flexion: [6, 0.5],
  tricep_extension: [5, 0.5],
  shoulder_press: [8, 0.5],
  shoulder_abduction: [3, 0.25],
  front_raise: [3, 0.25],
  chest_press: [10, 1],
  pec_fly: [5, 0.5],
  lat_pulldown: [25, 1.5],
  bent_over_row: [10, 1],
  deadlift: [30, 2.5],
  squat: [10, 1],
  lunge: [0, 0],
  seated_knee_extension: [0, 0],
  crunch: [0, 0],
  ab_twist: [4, 0],
}

/**
 * Six weeks of believable practice for every exercise, different for every seed: each exercise
 * starts a quarter to two fifths of its range short of its goal and closes most of that gap; two or three
 * sessions a week on random days (Monday to Saturday) and times; reps fade within a set less as
 * the weeks go by; about one session in eight is an off day with lower range, more fatigue and
 * sometimes a last set ended early. Each session holds a weight that rises week by week (from a
 * stream of its own, so the reps a seed gives never change). The same seed always gives the same
 * data.
 *
 * `tzOffsetMinutes` is the viewer's `Date#getTimezoneOffset()` (240 in New York in October), so
 * the days and hours read as a real routine on their clock rather than on the server's UTC one.
 */
export function generateDemoSessions(profileId: string, now = Date.now(), seed = 42, tzOffsetMinutes = 0): DemoSession[] {
  const rand = mulberry32(seed)
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
  const noise = (amp: number) => (rand() * 2 - 1) * amp
  const sessions: DemoSession[] = []
  // The weights come from their own stream, so adding them left every rep of a seed as it was.
  const weigh = mulberry32(seed ^ 0x5eed)

  // Work on the viewer's wall clock (local time written as if it were UTC): find this week's
  // Monday 00:00 there, walk back WEEKS - 1 weeks, then shift each start back to a real instant.
  const offsetMs = tzOffsetMinutes * 60_000
  const today = new Date(now - offsetMs)
  const daysSinceMonday = (today.getUTCDay() + 6) % 7
  const thisMonday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysSinceMonday)

  for (const exercise of EXERCISE_IDS) {
    const cfg = EXERCISES[exercise]
    // Start a quarter to two fifths of the movement's range short of the goal, and close most of
    // that gap over the six weeks: 32 to 52 degrees for a curl, a few degrees for a twist.
    const range = cfg.targetDeg - cfg.restDeg
    const gap = range * between(0.25, 0.4)
    const gain = (gap / WEEKS) * between(0.6, 1.1)
    const steadiness = between(0.7, 1.3)
    const [startKg, perWeekKg] = DEMO_LOAD[exercise]
    const strength = 0.85 + weigh() * 0.3
    for (let week = 0; week < WEEKS; week++) {
      const weekMonday = thisMonday - (WEEKS - 1 - week) * 7 * DAY
      const days = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5).slice(0, rand() < 0.4 ? 2 : 3).sort((a, b) => a - b)
      for (const day of days) {
        const hour = HOURS[Math.floor(rand() * HOURS.length)]!
        const startedAt = weekMonday + day * DAY + hour * 3_600_000 + Math.floor(rand() * 4) * 15 * 60_000 + offsetMs
        if (startedAt > now) continue
        const offDay = rand() < 0.12
        const sessionPeak = cfg.targetDeg - gap + gain * week + noise(range * 0.02) - (offDay ? range * between(0.03, 0.07) : 0)
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
            const peak = sessionPeak - decayPerRep * (range / 140) * i - (range / 140) * 1.5 * (setNumber - 1) + noise(range * 0.01)
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
          loadKg: Math.round((startKg * strength + perWeekKg * week) * 2) / 2,
        })
      }
    }
  }
  return sessions
}
