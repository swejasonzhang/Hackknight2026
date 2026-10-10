import { animate, motion, useInView, useReducedMotion, type Variants } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/* Motion principles: instruments settle, they do not bounce or fade in on scroll. */
export const ease: [number, number, number, number] = [0.2, 0, 0, 1]
export const DURATION = 0.24

/** Route-level wrapper: a short settle on mount. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION, ease }}>
      {children}
    </motion.div>
  )
}

const parent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const child: Variants = { hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { duration: DURATION, ease } } }

/** Children settle one after another, 40 ms apart. */
export function Stagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={parent} initial={reduce ? 'show' : 'hidden'} animate="show">
      {children}
    </motion.div>
  )
}

/** Like Stagger, but starts when the block enters the viewport (once). */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={parent} initial={reduce ? 'show' : 'hidden'} whileInView="show" viewport={{ once: true, margin: '-40px' }}>
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

/** Kept for API compatibility: on this system a hover does not lift; it is a plain container. */
export function Lift({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

/** A number that counts up to its value when it first scrolls into view. */
export function AnimatedNumber({ value, decimals = 0, suffix = '', duration = 0.6 }: { value: number; decimals?: number; suffix?: string; duration?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [shown, setShown] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    if (!inView) return
    const controls = animate(0, value, { duration, ease, onUpdate: (v) => setShown(v) })
    return () => controls.stop()
  }, [inView, reduce, value, duration])
  return (
    <span ref={ref}>
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  )
}

/** Kept for API compatibility: nothing floats on this system. */
export function Float({ children, className = '' }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={className}>{children}</div>
}
