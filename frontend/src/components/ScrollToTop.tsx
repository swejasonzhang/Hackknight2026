import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * A new page opens at its top. Only the path counts: a query change (the plan's ?day=) or an
 * in-page #anchor keeps the reader where they are.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
