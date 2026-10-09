/**
 * Shared engine types. Everything in src/engine is pure TypeScript with no DOM or
 * MediaPipe imports, so it can be unit-tested and reused server-side.
 */

export interface Point3 {
  x: number
  y: number
  z: number
}

/** One MediaPipe pose landmark (normalized image coords or metric world coords). */
export interface PoseLandmark extends Point3 {
  visibility?: number
}

/** Indices into MediaPipe's 33-landmark pose model. */
export const LM = {
  NOSE: 0,
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

export type Side = 'left' | 'right'

export type ExerciseId = 'elbow_flexion' | 'shoulder_abduction' | 'seated_knee_extension'

/** [proximal landmark, joint (vertex) landmark, distal landmark] */
export type JointTriple = readonly [number, number, number]

export interface ExerciseConfig {
  id: ExerciseId
  name: string
  /** One-line instruction shown to the patient, including how to face the camera. */
  cue: string
  joints: Record<Side, JointTriple>
  /** Label for the number we display and count, e.g. "Elbow flexion" or "Knee angle". */
  metricLabel: string
  /**
   * Converts the raw inner angle at the joint (0..180, 180 = straight) into the metric we
   * show and count. The metric must INCREASE as the patient moves deeper into the rep.
   */
  metricFromInnerAngle: (innerDeg: number) => number
  /** A rep is "in" once the metric reaches enterDeg and completes when it falls back to exitDeg. */
  enterDeg: number
  exitDeg: number
  /** Default PT target for the metric, drawn on the dashboard. */
  targetDeg: number
  /** Reps shorter than this are treated as jitter and ignored. */
  minRepMs: number
}

export interface RepRecord {
  /** 1-based index within the set */
  index: number
  /** Peak metric reached during the rep, in degrees */
  peakDeg: number
  startedAt: number
  endedAt: number
  durationMs: number
}

/**
 * A PROXY for fatigue, not a clinical measure: how much peak ROM shrank and how much
 * rep tempo slowed between the first and last reps of a set.
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
  /** True when the fatigue proxy ended the set before the planned rep count. */
  endedEarly: boolean
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
  /** Mean fatigue index across sets */
  fatigueIndex: number
}

export interface SessionRecord {
  id: string
  exercise: ExerciseId
  side: Side
  startedAt: number
  endedAt: number
  plan: SessionPlan
  sets: SetRecord[]
  summary: SessionSummary
  /** Seeded demo data, shown with a label on the dashboard. */
  demo: boolean
}
