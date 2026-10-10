import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'

/** A thin blue line along the top edge that fills as the page scrolls. */
export function ScrollProgress() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.3 })
  return <motion.div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] origin-left bg-primary shadow-[0_0_12px_rgb(0_161_255/0.9)]" style={{ scaleX: reduce ? scrollYProgress : scaleX }} />
}
