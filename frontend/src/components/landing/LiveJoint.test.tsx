import { EXERCISES } from '@arc/dependencies'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

// The keyframes the hero's angle is animated through, as handed to Motion.
const seen = vi.hoisted(() => ({ frames: [] as number[][] }))
vi.mock('motion/react', async (original) => {
  const motion = await original<typeof import('motion/react')>()
  return {
    ...motion,
    animate: (value: unknown, frames: unknown, options: unknown) => {
      if (Array.isArray(frames)) seen.frames.push(frames as number[])
      return motion.animate(value as never, frames as never, options as never)
    },
  }
})
vi.mock('../three/lazy', () => ({
  LazyJointScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  SceneBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
const { LiveJoint } = await import('./LiveJoint')

describe('LiveJoint, the landing hero', () => {
  it('curls from a straight arm, 0°, up past the goal line and all the way back to 0° every rep', () => {
    render(<LiveJoint />)
    const frames = seen.frames.at(-1)!
    expect(EXERCISES.elbow_flexion.restDeg).toBe(0)
    expect(frames[0]).toBe(0)
    expect(frames.at(-1)).toBe(0)
    // Every other keyframe is a rep's bottom: back at 0°, not a few degrees short of it.
    expect(frames.filter((_, i) => i % 2 === 0).every((f) => f === 0)).toBe(true)
    expect(Math.min(...frames)).toBe(0)
    expect(Math.max(...frames)).toBeLessThanOrEqual(EXERCISES.elbow_flexion.maxDeg)
    // Every rep's top reaches the goal line: the demo shows reps that hit their target.
    for (const peak of frames.filter((_, i) => i % 2 === 1)) expect(peak).toBeGreaterThanOrEqual(EXERCISES.elbow_flexion.targetDeg)
  })
})
