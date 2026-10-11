import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

// 3D scenes need WebGL; here each stands in as its label.
vi.mock('../three/lazy', () => ({
  LazyJointScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  LazyProgressScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  SceneBoundary: ({ children }: { children: ReactNode }) => children,
}))
const { DemoBoard } = await import('./DemoBoard')

describe('the landing readouts', () => {
  it('picks any of the fifteen movements by body area, and reads out the weight held', () => {
    render(<DemoBoard />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Back' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deadlift' }))
    expect(screen.getByText('Weight held')).toBeInTheDocument()
    expect(screen.getByText(/kg in week 1/)).toBeInTheDocument()
  })

  it('shows the body with the muscles a movement works', async () => {
    render(<DemoBoard />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Muscles' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Muscles' }))
    // The last view leaves before the next arrives.
    expect(await screen.findByRole('img', { name: /bicep curl reps to the 140 degree goal/i }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Biceps')).toBeInTheDocument()
    expect(screen.getByText('Forearms')).toBeInTheDocument()
  })

  it("ranks a demo household on this week's training", async () => {
    render(<DemoBoard />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Household' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Household' }))
    const board = await screen.findByRole('list', { name: 'Ranked by arc score' }, { timeout: 3000 })
    const rows = within(board).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.getAttribute('aria-label')).toMatch(/^1st: (Maya|Theo|Nana Rose), \d+ Arc score$/)
    fireEvent.click(screen.getByRole('button', { name: 'Reps' }))
    expect(screen.getByRole('list', { name: 'Ranked by reps' })).toBeInTheDocument()
  })
})
