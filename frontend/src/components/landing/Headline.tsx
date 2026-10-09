import { motion, useReducedMotion, type Variants } from 'motion/react'
import { ease } from '../motion'

const parent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }
const word: Variants = { hidden: { opacity: 0, y: 18, filter: 'blur(6px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease } } }

/** The tagline, revealed word by word, with the key phrase in the brand gradient. */
export function Headline() {
  const reduce = useReducedMotion()
  const parts: { text: string; accent?: boolean }[] = [
    { text: 'See' },
    { text: 'your' },
    { text: 'range', accent: true },
    { text: 'of', accent: true },
    { text: 'motion', accent: true },
    { text: 'improve,' },
    { text: 'week' },
    { text: 'by' },
    { text: 'week.' },
  ]
  return (
    <motion.h1 className="display mt-6 max-w-[12ch]" variants={parent} initial={reduce ? 'show' : 'hidden'} animate="show">
      {parts.map((p, i) => (
        <motion.span key={i} className={`inline-block ${p.accent ? 'text-gradient' : ''}`} variants={word}>
          {p.text}
          {i < parts.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.h1>
  )
}
