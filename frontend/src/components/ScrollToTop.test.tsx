import { act, render } from '@testing-library/react'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollToTop } from './ScrollToTop'

let navigate!: NavigateFunction
function Grab() {
  navigate = useNavigate()
  return null
}

describe('ScrollToTop', () => {
  afterEach(() => vi.restoreAllMocks())

  it('opens a new page at the top, but leaves a query change where it is', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/account']}>
        <ScrollToTop />
        <Grab />
      </MemoryRouter>,
    )
    scrollTo.mockClear()
    act(() => {
      void navigate('/')
    })
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    scrollTo.mockClear()
    act(() => {
      void navigate('/?day=2026-10-10')
    })
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
