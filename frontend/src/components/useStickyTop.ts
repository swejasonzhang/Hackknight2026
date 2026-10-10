import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * The `top` for a sticky side column that never needs a scrollbar of its own: a column that fits
 * the window pins `gap` px from the top; a taller one gets a negative top, so it scrolls with the
 * page until its bottom edge is `gap` px above the window's and then holds there.
 */
export function useStickyTop<T extends HTMLElement>(gap = 32): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [top, setTop] = useState(gap)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setTop(Math.min(gap, window.innerHeight - el.offsetHeight - gap))
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(el)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [gap])

  return [ref, top]
}
