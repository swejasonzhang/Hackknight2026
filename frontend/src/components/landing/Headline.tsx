import { motion, useReducedMotion, type Variants } from 'motion/react'
import { ease } from '../motion'

const parent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }
const word: Variants = { hidden: { opacity: 0, y: 24, filter: 'blur(8px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease } } }

/** The glowing display headline, one block per line, revealed word by word. */
export function Headline({ lines, className = '' }: { lines: string[]; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.h1 className={`display glow-text ${className}`.trim()} variants={parent} initial={reduce ? 'show' : 'hidden'} animate="show">
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(' ').map((w, wi, arr) => (
            <motion.span key={wi} className="inline-block" variants={word}>
              {w}
              {wi < arr.length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.h1>
  )
}
