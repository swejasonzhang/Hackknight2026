import { motion, useReducedMotion } from 'motion/react'

/** Two soft colour fields that drift slowly behind the hero. */
export function Blobs() {
  const reduce = useReducedMotion()
  const drift = (x: number[], y: number[], duration: number) => (reduce ? undefined : { x, y, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const } })
  return (
    <>
      <motion.div aria-hidden="true" className="pointer-events-none absolute -top-48 -left-40 h-[560px] w-[560px] rounded-full bg-primary opacity-[0.10] blur-3xl" animate={drift([0, 60, -30, 0], [0, -40, 30, 0], 22)} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute -right-40 -bottom-48 h-[520px] w-[520px] rounded-full bg-accent opacity-[0.12] blur-3xl" animate={drift([0, -50, 30, 0], [0, 40, -30, 0], 26)} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute top-1/3 right-1/4 h-[320px] w-[320px] rounded-full bg-primary-2 opacity-[0.07] blur-3xl" animate={drift([0, 40, -40, 0], [0, 30, 50, 0], 30)} />
      <div aria-hidden="true" className="dots pointer-events-none absolute inset-0" />
    </>
  )
}
