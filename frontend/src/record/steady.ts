import { OneEuroFilter, type OneEuroOptions } from '@arc/dependencies'
import type { Landmark } from './angle'

/*
 * The pose model's landmarks shake by a few pixels from frame to frame even when the member holds
 * still, and its confidence in a landmark flickers as a hand passes the body. Everything the
 * recorder reads and draws goes through here first: each landmark smoothed on its own (the One Euro
 * filter: steady when the limb is still, quick to follow when it moves), its visibility eased so
 * one doubtful frame does not drop the joint, and a short gap in the model's output bridged.
 */

/** Across the picture, in its width and height (0..1): a wrist in a curl moves about 0.5 a second at most. */
const IMAGE: Partial<OneEuroOptions> = { minCutoff: 0.6, beta: 8, dCutoff: 1 }
/** In the world, in metres: a wrist in a curl moves about a metre a second at most. */
const WORLD: Partial<OneEuroOptions> = { minCutoff: 0.6, beta: 4, dCutoff: 1 }
/** How quickly the eased visibility follows the model's, in seconds. */
const VISIBILITY_TAU_S = 0.15
/** A frame with nobody found (the model missed one) is bridged with the last pose for this long. */
export const HOLD_MS = 250

export interface PoseFrame {
  /** The 33 landmarks across the picture. */
  landmarks: Landmark[]
  /** The same 33 in metres round the hips, when the model gives them: the true 3D angles. */
  world: Landmark[] | null
}

class SteadyPoints {
  private filters: OneEuroFilter[][] = []
  private visibility: number[] = []
  private lastT = 0
  private readonly opts: Partial<OneEuroOptions>
  private readonly axes: 2 | 3

  constructor(opts: Partial<OneEuroOptions>, axes: 2 | 3) {
    this.opts = opts
    this.axes = axes
  }

  feed(points: readonly Landmark[], tMs: number): Landmark[] {
    const dt = this.filters.length ? Math.max(0, tMs - this.lastT) / 1000 : 0
    this.lastT = tMs
    const ease = dt > 0 ? 1 - Math.exp(-dt / VISIBILITY_TAU_S) : 1
    return points.map((p, i) => {
      const f = (this.filters[i] ??= Array.from({ length: this.axes }, () => new OneEuroFilter(this.opts)))
      const raw = p.visibility ?? 1
      const v = (this.visibility[i] = this.visibility[i] == null ? raw : this.visibility[i]! + (raw - this.visibility[i]!) * ease)
      const out: Landmark = { x: f[0]!.filter(p.x, tMs), y: f[1]!.filter(p.y, tMs), visibility: v }
      if (this.axes === 3) out.z = f[2]!.filter(p.z ?? 0, tMs)
      else if (p.z != null) out.z = p.z
      return out
    })
  }

  reset() {
    this.filters = []
    this.visibility = []
  }
}

/**
 * Steadies the pose frame by frame. Feed it every frame the model is asked about, with what the
 * model returned (null when it found nobody); it returns the steadied pose, or null once nobody has
 * been in view for longer than a dropout. A new person (after a gap) starts fresh.
 */
export class SteadyPose {
  private readonly image = new SteadyPoints(IMAGE, 2)
  private readonly world = new SteadyPoints(WORLD, 3)
  private last: PoseFrame | null = null
  private seenAt = -Infinity

  feed(frame: PoseFrame | null, tMs: number): PoseFrame | null {
    if (!frame) {
      if (this.last && tMs - this.seenAt <= HOLD_MS) return this.last
      this.reset()
      return null
    }
    if (this.last && tMs - this.seenAt > HOLD_MS) this.reset()
    this.seenAt = tMs
    this.last = { landmarks: this.image.feed(frame.landmarks, tMs), world: frame.world ? this.world.feed(frame.world, tMs) : null }
    return this.last
  }

  reset() {
    this.image.reset()
    this.world.reset()
    this.last = null
  }
}
