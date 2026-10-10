import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Folds } from './Folds'

const ITEMS = [
  { id: 'peak', index: '01', title: 'Peak per session', summary: '133° best', render: () => <p>peak chart</p> },
  { id: 'fatigue', index: '02', title: 'Fatigue per session', summary: '0.07 latest', aside: 'A proxy, not a clinical measure', render: () => <p>fatigue chart</p> },
]

describe('Folds', () => {
  it('starts with every chart folded behind a plus, showing only its title and summary', () => {
    render(<Folds label="Charts" items={ITEMS} />)
    const peak = screen.getByRole('button', { name: /Peak per session/ })
    expect(peak).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('133° best')).toBeInTheDocument()
    expect(screen.queryByText('peak chart')).not.toBeInTheDocument()
  })

  it('opens a chart when its plus is pressed and folds it again', () => {
    render(<Folds label="Charts" items={ITEMS} />)
    const fatigue = screen.getByRole('button', { name: /Fatigue per session/ })
    fireEvent.click(fatigue)
    expect(fatigue).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('fatigue chart')).toBeInTheDocument()
    expect(screen.getByText('A proxy, not a clinical measure')).toBeInTheDocument()
    expect(screen.queryByText('peak chart')).not.toBeInTheDocument()
    fireEvent.click(fatigue)
    expect(fatigue).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens and closes them all at once', () => {
    render(<Folds label="Charts" items={ITEMS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open all' }))
    expect(screen.getByText('peak chart')).toBeInTheDocument()
    expect(screen.getByText('fatigue chart')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close all' }))
    expect(screen.getByRole('button', { name: /Peak per session/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Fatigue per session/ })).toHaveAttribute('aria-expanded', 'false')
  })
})
