import { animate, motion, useReducedMotion, type Variants } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'

/* Motion primitives. Every one of them degrades to a static render when the OS asks for reduced motion. */

export const ease: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** Fade-and-rise on mount; wrap each page in it. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
      {children}
    </motion.div>
  )
}

const parent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }
const child: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } } }

/** Children wrapped in <Item> reveal one after another. */
export function Stagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={parent} initial={reduce ? 'show' : 'hidden'} animate="show">
      {children}
    </motion.div>
  )
}

export function Item({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={child}>
      {children}
    </motion.div>
  )
}

/** Counts from 0 to `value` on mount and whenever `value` changes. */
export function AnimatedNumber({ value, decimals = 0, suffix = '', duration = 0.9 }: { value: number; decimals?: number; suffix?: string; duration?: number }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    const controls = animate(display, value, { duration, ease: 'easeOut', onUpdate: (v) => setDisplay(v) })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce])
  return (
    <>
      {display.toFixed(decimals)}
      {suffix}
    </>
  )
}

/** Slow vertical drift for decorative elements. */
export function Float({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}>
      {children}
    </motion.div>
  )
}
