import type { RejectedRep } from './form.ts'

/**
 * Domain types shared by the server and the browser (recorder, dashboard, Arc's pages); the
 * Python camera app maps its own catalog onto the same exercise ids and counts reps at the same
 * thresholds (computer-vision/arc_catalog.json).
 * Everything in dependencies/src/engine is pure TypeScript: no DOM, no Node, no MediaPipe.
 */

export type Side = 'left' | 'right'

/**
 * Every movement Arc tracks: the camera app's fourteen catalog exercises (movements.py) plus the
 * seated knee extension, in the order the dashboard lists them. The first three ids predate the
 * catalog; they keep their ids so stored sessions stay valid, under the catalog's names.
 */
export const EXERCISE_IDS = [
  'elbow_flexion',
  'tricep_extension',
  'shoulder_press',
  'shoulder_abduction',
  'front_raise',
  'chest_press',
  'pec_fly',
  'lat_pulldown',
  'bent_over_row',
  'deadlift',
  'squat',
  'lunge',
  'seated_knee_extension',
  'crunch',
  'ab_twist',
] as const

export type ExerciseId = (typeof EXERCISE_IDS)[number]

/** The dashboard's four tabs. */
export type BodyArea = 'upper' | 'back' | 'legs' | 'core'

/**
 * The muscle groups the exercises work, as a trainer names them. The back is three groups, not a
 * left and a right: the upper back (rhomboids and the middle of the trapezius), the lats and the
 * lower back (the spinal erectors).
 */
export const MUSCLE_IDS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'traps',
  'upper_back',
  'lats',
  'lower_back',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const

export type MuscleId = (typeof MUSCLE_IDS)[number]

/** What an exercise works: the muscles it targets, and the ones that help or hold the body steady. */
export interface MuscleWork {
  primary: readonly MuscleId[]
  secondary: readonly MuscleId[]
}

/** Indices into MediaPipe's 33-landmark pose model, as the browser recorder, the 3D figure and the camera app number them. */
export const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const

/** [proximal landmark, joint (vertex) landmark, distal landmark] */
export type JointTriple = readonly [number, number, number]

export interface ExerciseConfig {
  id: ExerciseId
  name: string
  /** A word or two for tight spots: tabs, calendar cells. */
  short: string
  area: BodyArea
  /**
   * True when one arm or leg does the work and the member picks which (a curl, a lunge). False when
   * both sides work together or the trunk does (a squat, a deadlift, a crunch): there is no side to
   * pick, and the recorder measures whichever side the camera sees better.
   */
  sided: boolean
  muscles: MuscleWork
  /** One-line instruction for the user, including how to face the camera. */
  cue: string
  /**
   * Which landmarks the recorder measures the angle at, per side (the camera app's catalog uses the same). With `measure: 'tilt'` the
   * metric is instead the slope of the line from the first landmark to the second against the
   * horizontal (the third repeats the second).
   */
  joints: Record<Side, JointTriple>
  measure?: 'angle' | 'tilt'
  /** Label for the number we display and count, e.g. "Elbow flexion" or "Knee angle". */
  metricLabel: string
  /**
   * CONTRACT WITH THE RECORDER (and the camera app's upload): it converts the raw inner angle
   * at the joint (0..180, 180 = straight) into this metric, which must INCREASE as the user
   * moves deeper into the rep. Everything downstream (rep counter, fatigue, dashboard) uses the metric.
   */
  metricFromInnerAngle: (innerDeg: number) => number
  /** A rep is "in" once the metric reaches enterDeg and completes when it falls back to exitDeg. */
  enterDeg: number
  exitDeg: number
  /** Default goal for the metric, drawn on the dashboard. */
  targetDeg: number
  /** The metric in the start position, and the furthest the movement goes (the figure, and any goal, stop there). */
  restDeg: number
  maxDeg: number
  /** Reps shorter than this are treated as jitter and ignored. */
  minRepMs: number
}

export interface RepRecord {
  /** 1-based index within the set */
  index: number
  /** Peak metric reached during the rep, in degrees */
  peakDeg: number
  /** ms since epoch */
  startedAt: number
  endedAt: number
  durationMs: number
}

/**
 * A PROXY for fatigue, not a clinical measure: how much peak ROM shrank and how much rep
 * tempo slowed between the first and last reps of a set.
 */
export interface FatigueEstimate {
  /** 0..1 combined index; 0 = no change across the set */
  index: number
  /** Fraction of ROM lost from the first reps to the last reps (0.1 = lost 10%) */
  romDecay: number
  /** Fractional slowdown in rep duration (0.2 = reps take 20% longer) */
  tempoDrift: number
  /** Absolute ROM lost, in degrees */
  romDropDeg: number
  /** How many reps the estimate is based on */
  sampleReps: number
}

export interface SetRecord {
  setNumber: number
  reps: RepRecord[]
  fatigue: FatigueEstimate
  startedAt: number
  endedAt: number
  /** True when the set ended before the planned rep count (fatigue stop or manual). */
  endedEarly: boolean
  /** Reps that were not counted for their form, and why (absent from older sessions and the camera app). */
  rejected?: RejectedRep[]
}

export interface SessionPlan {
  sets: number
  reps: number
  restSeconds: number
  targetDeg: number
}

export interface SessionSummary {
  totalReps: number
  bestPeakDeg: number
  meanPeakDeg: number
  /** Mean fatigue index across sets that had enough reps */
  fatigueIndex: number
}

/** One completed exercise session, as stored. */
export interface SessionRecord {
  id: string
  profileId: string
  exercise: ExerciseId
  side: Side
  startedAt: number
  endedAt: number
  plan: SessionPlan
  sets: SetRecord[]
  summary: SessionSummary
  /** Seeded demo data, labelled on the dashboard. */
  demo: boolean
  /**
   * False while a recording is still being saved set by set (or if it stopped before its end);
   * every set it holds is real. Absent or true once finished.
   */
  complete?: boolean
  /** Voice commands the member gave while recording, in order. */
  events?: SessionEvent[]
  /** The weight held, in kilograms (0 for bodyweight); absent when it was not given. */
  loadKg?: number
  /** Arc's plain-English read of the session (Gemini, or a template when Gemini is off). */
  coachSummary?: CoachSummary | null
}

/** What a member can say to Arc while recording, hands-free. */
export const VOICE_COMMANDS = ['start', 'pause', 'resume', 'skip', 'rest', 'stop', 'status', 'repeat'] as const
export type VoiceCommand = (typeof VOICE_COMMANDS)[number]

export interface SessionEvent {
  /** ms since epoch */
  at: number
  command: VoiceCommand
}

export interface CoachSummary {
  text: string
  /** The stored coach message, for its audio. */
  messageId: string
  createdAt: number
  /** True when Gemini was not configured and the summary came from Arc's template. */
  offline: boolean
}
