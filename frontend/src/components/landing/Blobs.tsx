import { motion, useReducedMotion } from 'motion/react'

/** Blue light behind the hero on black: a slow-drifting glow and a faint panning grid. */
export function Blobs() {
  const reduce = useReducedMotion()
  const drift = (x: number[], y: number[], duration: number) => (reduce ? undefined : { x, y, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const } })
  return (
    <>
      <motion.div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary opacity-[0.16] blur-3xl" animate={drift([0, 40, -30, 0], [0, 20, -10, 0], 24)} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute top-[40%] -right-40 h-[420px] w-[420px] rounded-full bg-sky opacity-[0.08] blur-3xl" animate={drift([0, -50, 30, 0], [0, 40, -30, 0], 28)} />
      <div aria-hidden="true" className="grid-lines pointer-events-none absolute inset-0" />
    </>
  )
}
