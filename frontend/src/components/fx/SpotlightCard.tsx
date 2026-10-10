import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

/** A card whose border and surface light up where the pointer is. Pure CSS after the pointer position is set. */
export function SpotlightCard({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  const ref = useRef<HTMLElement>(null)
  const move = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  const style = { '--mx': '50%', '--my': '50%' } as CSSProperties
  return (
    <Tag ref={ref as never} className={`spotlight ${className}`.trim()} style={style} onPointerMove={move}>
      {children}
    </Tag>
  )
}
