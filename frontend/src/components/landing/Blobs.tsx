import { motion, useReducedMotion } from 'motion/react'

/** Soft blue light behind the hero, drifting slowly, plus a faint panning grid. */
export function Blobs() {
  const reduce = useReducedMotion()
  const drift = (x: number[], y: number[], duration: number) => (reduce ? undefined : { x, y, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const } })
  return (
    <>
      <motion.div aria-hidden="true" className="pointer-events-none absolute -top-48 -left-40 h-[600px] w-[600px] rounded-full bg-primary opacity-[0.12] blur-3xl" animate={drift([0, 60, -30, 0], [0, -40, 30, 0], 22)} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-sky opacity-[0.14] blur-3xl" animate={drift([0, -50, 30, 0], [0, 40, -30, 0], 26)} />
      <div aria-hidden="true" className="grid-lines pointer-events-none absolute inset-0" />
    </>
  )
}
