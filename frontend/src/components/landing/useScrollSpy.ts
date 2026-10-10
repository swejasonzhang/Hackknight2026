import { useEffect, useState } from 'react'

/**
 * Which of the given section ids sits under the reading line, a thin band 30% down the
 * viewport. Drives the landing index; the only scroll-linked behaviour on the page.
 * Pass a stable array (a module constant), and the first id is active until the page moves.
 */
export function useScrollSpy(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).at(-1)
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-30% 0px -69% 0px', threshold: 0 },
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return active
}
