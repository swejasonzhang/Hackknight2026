import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const put = vi.fn()
vi.mock('../api/client', () => ({ api: { plan: { put: (...args: unknown[]) => put(...args) } } }))

const { PlanEditor } = await import('./PlanEditor')

describe('PlanEditor', () => {
  beforeEach(() => put.mockReset())

  it('picks a target muscle, then a movement that works it and its side, and saves them', async () => {
    put.mockImplementation((_id: string, input: object) => Promise.resolve({ id: 'pl1', profileId: 'p1', active: true, createdAt: 1, ...input }))
    render(<PlanEditor profileId="p1" plan={null} onSaved={() => {}} />)

    expect(screen.getByRole('combobox', { name: 'Target muscle' })).toHaveTextContent('Biceps')
    expect(screen.getByRole('combobox', { name: 'Exercise' })).toHaveTextContent('Bicep curl')
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Target muscle' }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name: 'Side shoulders' }))
    // The movement follows the muscle: the lateral raise targets it first.
    expect(screen.getByRole('combobox', { name: 'Exercise' })).toHaveTextContent('Lateral raise')

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Side' }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name: 'Left' }))

    fireEvent.click(screen.getByRole('button', { name: /save plan/i }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(put.mock.calls[0]![1]).toMatchObject({ exercise: 'shoulder_abduction', side: 'left', targetDeg: 90 })
  })

  it('offers the back as upper back, lats and lower back, with no left or right for a deadlift', () => {
    render(<PlanEditor profileId="p1" plan={null} onSaved={() => {}} />)
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Target muscle' }), { key: 'Enter' })
    for (const name of ['Upper back', 'Lats', 'Lower back']) expect(screen.getByRole('option', { name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Lower back' }))

    expect(screen.getByRole('combobox', { name: 'Exercise' })).toHaveTextContent('Deadlift')
    expect(screen.queryByRole('combobox', { name: 'Side' })).not.toBeInTheDocument()
    expect(screen.getByText('Both sides')).toBeInTheDocument()
    // The key names what the deadlift works.
    expect(screen.getByText('Hamstrings, Glutes, Lower back')).toBeInTheDocument()
  })

  it('lists the movements a muscle only helps in after the ones that target it', () => {
    render(<PlanEditor profileId="p1" plan={null} onSaved={() => {}} />)
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Target muscle' }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name: 'Lower back' }))
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Exercise' }), { key: 'Enter' })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Deadlift', 'Bent-over row (also works it)', 'Squat (also works it)', 'Ab twist (also works it)'])
  })
})
