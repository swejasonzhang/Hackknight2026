import { EXERCISES } from './exercises.ts'
import { LM, type ExerciseId, type Side } from './types.ts'

/**
 * Form checks: a rep counts only when it is done right. While a rep is under way the pose is
 * checked against what the movement must keep (the upper arm still in a curl, the body still
 * rather than swinging, the arm straight in a raise...); a rep that broke one is not counted, and
 * the reason is kept so Arc can say it. Reps faster than the movement's floor are refused too.
 * Pure TypeScript on plain landmark points, so the browser recorder and its tests share it.
 */
export const FORM_FAULTS = ['too_fast', 'upper_arm_moved', 'body_swing', 'arm_bent', 'back_moved', 'thigh_moved', 'chest_dropped'] as const
export type FormFault = (typeof FORM_FAULTS)[number]

/** What Arc says when a rep did not count, and what to change. */
export const FAULT_LINE: Record<FormFault, string> = {
  too_fast: 'That one was too quick to count. Slow it down.',
  upper_arm_moved: "That one didn't count: keep your upper arm still.",
  body_swing: "That one didn't count: keep your body still, no swinging.",
  arm_bent: "That one didn't count: keep your arm straight.",
  back_moved: "That one didn't count: keep your back still.",
  thigh_moved: "That one didn't count: keep your thigh on the seat.",
  chest_dropped: "That one didn't count: keep your chest up.",
}

/** The same faults in a few words, for a set's read ("2 reps did not count: the upper arm moved"). */
export const FAULT_WORDS: Record<FormFault, string> = {
  too_fast: 'too quick',
  upper_arm_moved: 'the upper arm moved',
  body_swing: 'the body swung',
  arm_bent: 'the arm bent',
  back_moved: 'the back moved',
  thigh_moved: 'the thigh lifted',
  chest_dropped: 'the chest dropped',
}

/** The change that fixes each fault, as the next set's one thing to do. */
export const FAULT_FIX: Record<FormFault, string> = {
  too_fast: 'slow each rep down',
  upper_arm_moved: 'keep your upper arm still',
  body_swing: 'keep your body still, no swinging',
  arm_bent: 'keep your arm straight',
  back_moved: 'keep your back still',
  thigh_moved: 'keep your thigh on the seat',
  chest_dropped: 'keep your chest up',
}

export interface RejectedRep {
  /** When the rep ended, ms since the epoch. */
  at: number
  fault: FormFault
}

type Part = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle'
type Check =
  /** The segment's direction may not turn more than `maxDeg` from where the rep started. */
  | { kind: 'steady'; from: Part; to: Part; maxDeg: number; fault: FormFault }
  /** The angle at the middle part must stay at least `minDeg` (a straight limb is 180). */
  | { kind: 'straight'; joint: readonly [Part, Part, Part]; minDeg: number; fault: FormFault }

const upperArm: Check = { kind: 'steady', from: 'shoulder', to: 'elbow', maxDeg: 25, fault: 'upper_arm_moved' }
const noSwing: Check = { kind: 'steady', from: 'shoulder', to: 'hip', maxDeg: 15, fault: 'body_swing' }
const straightArm: Check = { kind: 'straight', joint: ['shoulder', 'elbow', 'wrist'], minDeg: 140, fault: 'arm_bent' }

/**
 * What each movement must keep while a rep is under way. Movements where the whole body moves by
 * design (deadlift, squat, crunch, twist, pec fly) are judged on depth and tempo alone.
 */
export const FORM_CHECKS: Record<ExerciseId, readonly Check[]> = {
  elbow_flexion: [upperArm, noSwing],
  tricep_extension: [upperArm],
  shoulder_press: [noSwing],
  shoulder_abduction: [straightArm, noSwing],
  front_raise: [straightArm, noSwing],
  chest_press: [{ ...noSwing, maxDeg: 20 }],
  pec_fly: [],
  lat_pulldown: [{ ...noSwing, maxDeg: 20 }],
  bent_over_row: [{ kind: 'steady', from: 'shoulder', to: 'hip', maxDeg: 20, fault: 'back_moved' }],
  deadlift: [],
  squat: [],
  lunge: [{ kind: 'steady', from: 'shoulder', to: 'hip', maxDeg: 25, fault: 'chest_dropped' }],
  seated_knee_extension: [{ kind: 'steady', from: 'hip', to: 'knee', maxDeg: 20, fault: 'thigh_moved' }],
  crunch: [],
  ab_twist: [],
}

const INDEX: Record<Side, Record<Part, number>> = {
  left: { shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST, hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE },
  right: { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE },
}

/** A pose landmark as the tracker gives it: 0..1 across the picture, and how sure it is. */
export interface PosePoint {
  x: number
  y: number
  visibility?: number
}

const SEEN = 0.5
const deg = (r: number) => (r * 180) / Math.PI

/**
 * Watches one rep at a time for the movement's form checks: `start` at the rep's first frame,
 * `check` on every frame after (returns the first fault seen, or null), `reset` when it ends. A
 * check whose landmarks the model cannot see is skipped for that frame rather than failed.
 */
export class FormWatch {
  private readonly checks: readonly Check[]
  private readonly chosen: Side
  private readonly sided: boolean
  private side: Side
  private readonly aspect: number
  private startDirs = new Map<number, number>()
  private fault: FormFault | null = null

  constructor(exercise: ExerciseId, side: Side, aspect = 1) {
    this.checks = FORM_CHECKS[exercise]
    this.chosen = side
    this.side = side
    this.sided = EXERCISES[exercise].sided
    this.aspect = aspect
  }

  private point(pose: readonly PosePoint[], part: Part): [number, number] | null {
    const p = pose[INDEX[this.side][part]]
    if (!p || (p.visibility ?? 1) < SEEN) return null
    return [p.x * this.aspect, p.y]
  }

  private direction(pose: readonly PosePoint[], from: Part, to: Part): number | null {
    const a = this.point(pose, from)
    const b = this.point(pose, to)
    return a && b ? deg(Math.atan2(b[1] - a[1], b[0] - a[0])) : null
  }

  /** How well the model sees a side's shoulder and hip: the less visible of the two. */
  private seen(pose: readonly PosePoint[], side: Side): number {
    return Math.min(...(['shoulder', 'hip'] as const).map((p) => pose[INDEX[side][p]]?.visibility ?? 0))
  }

  start(pose: readonly PosePoint[]): void {
    // A movement with no side to pick is watched on whichever side the camera sees better.
    const other: Side = this.chosen === 'right' ? 'left' : 'right'
    this.side = !this.sided && this.seen(pose, other) > this.seen(pose, this.chosen) ? other : this.chosen
    this.fault = null
    this.startDirs = new Map()
    this.checks.forEach((c, i) => {
      if (c.kind !== 'steady') return
      const d = this.direction(pose, c.from, c.to)
      if (d != null) this.startDirs.set(i, d)
    })
  }

  check(pose: readonly PosePoint[]): FormFault | null {
    if (this.fault) return this.fault
    this.checks.forEach((c, i) => {
      if (this.fault) return
      if (c.kind === 'steady') {
        const d = this.direction(pose, c.from, c.to)
        if (d == null) return
        if (!this.startDirs.has(i)) {
          this.startDirs.set(i, d)
          return
        }
        const turned = Math.abs(((d - this.startDirs.get(i)! + 540) % 360) - 180)
        if (turned > c.maxDeg) this.fault = c.fault
      } else {
        const [a, b, m] = [this.point(pose, c.joint[0]), this.point(pose, c.joint[1]), this.point(pose, c.joint[2])]
        if (!a || !b || !m) return
        const u = [a[0] - b[0], a[1] - b[1]]
        const v = [m[0] - b[0], m[1] - b[1]]
        const cos = (u[0]! * v[0]! + u[1]! * v[1]!) / (Math.hypot(u[0]!, u[1]!) * Math.hypot(v[0]!, v[1]!))
        if (deg(Math.acos(Math.max(-1, Math.min(1, cos)))) < c.minDeg) this.fault = c.fault
      }
    })
    return this.fault
  }

  reset(): void {
    this.fault = null
    this.startDirs = new Map()
  }
}
