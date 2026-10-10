import { animate, motion, useInView, useReducedMotion, type Variants } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * Motion principles: instruments settle; they do not bounce. Things rise into place on one easing,
 * rules draw themselves across, numbers count from where they were, charts draw as they arrive.
 * Everything collapses to the final state under prefers-reduced-motion.
 */
export const ease: [number, number, number, number] = [0.2, 0, 0, 1]
export const DURATION = 0.24

/** Route-level wrapper: a short settle on mount. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease }}>
      {children}
    </motion.div>
  )
}

export const parentVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
export const riseVariants: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }
export const ruleVariants: Variants = { hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.7, ease } } }

/** Children rise one after another on mount. */
export function Stagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={parentVariants} initial={reduce ? 'show' : 'hidden'} animate="show">
      {children}
    </motion.div>
  )
}

/** Like Stagger, but starts when the block scrolls into view (once). */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={parentVariants} initial={reduce ? 'show' : 'hidden'} whileInView="show" viewport={{ once: true, margin: '-60px' }}>
      {children}
    </motion.div>
  )
}

export function Item({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={riseVariants}>
      {children}
    </motion.div>
  )
}

/** A hairline that draws itself from the left when it scrolls into view. */
export function RuleDraw({ className = '', strong = true, delay = 0 }: { className?: string; strong?: boolean; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      aria-hidden="true"
      className={`h-px origin-left ${strong ? 'bg-rule-strong' : 'bg-rule'} ${className}`.trim()}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.8, ease, delay }}
    />
  )
}

/**
 * A heading whose lines rise from behind a mask, one after another. `trigger="mount"` plays on
 * load (the hero); `"view"` plays when the heading scrolls into view.
 */
export function MaskLines({ lines, className = '', as: Tag = 'h2', trigger = 'view', delay = 0, id }: { lines: string[]; className?: string; as?: 'h1' | 'h2' | 'h3'; trigger?: 'mount' | 'view'; delay?: number; id?: string }) {
  const reduce = useReducedMotion()
  const MotionTag = motion[Tag]
  const play = trigger === 'mount' ? { animate: 'show' as const } : { whileInView: 'show' as const, viewport: { once: true, margin: '-40px' } }
  return (
    <MotionTag id={id} className={className} initial={reduce ? 'show' : 'hidden'} {...play} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: delay } } }}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]">
          <motion.span className="block" variants={{ hidden: { y: '108%' }, show: { y: '0%', transition: { duration: 0.75, ease } } }}>
            {line}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  )
}

/** Kept for API compatibility: on this system a hover does not lift; it is a plain container. */
export function Lift({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

/** A number that counts up when it first scrolls into view, then counts from its last value on every change. */
export function AnimatedNumber({ value, decimals = 0, suffix = '', duration = 0.7 }: { value: number; decimals?: number; suffix?: string; duration?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [shown, setShown] = useState(reduce ? value : 0)
  const last = useRef(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      last.current = value
      return
    }
    if (!inView) return
    const controls = animate(last.current, value, {
      duration,
      ease,
      onUpdate: (v) => {
        last.current = v
        setShown(v)
      },
    })
    return () => controls.stop()
  }, [inView, reduce, value, duration])
  return (
    <span ref={ref} className="tabular-nums">
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  )
}

/** Kept for API compatibility: nothing floats on this system. */
export function Float({ children, className = '' }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={className}>{children}</div>
}
