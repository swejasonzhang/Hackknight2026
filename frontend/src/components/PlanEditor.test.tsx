import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const put = vi.fn()
vi.mock('../api/client', () => ({ api: { plan: { put: (...args: unknown[]) => put(...args) } } }))

const { PlanEditor } = await import('./PlanEditor')

describe('PlanEditor', () => {
  beforeEach(() => put.mockReset())

  it('picks the exercise and side from themed dropdowns and saves them', async () => {
    put.mockImplementation((_id: string, input: object) => Promise.resolve({ id: 'pl1', profileId: 'p1', active: true, createdAt: 1, ...input }))
    render(<PlanEditor profileId="p1" plan={null} onSaved={() => {}} />)

    const exercise = screen.getByRole('combobox', { name: 'Exercise' })
    expect(exercise).toHaveTextContent('Bicep curl')
    fireEvent.keyDown(exercise, { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name: 'Lateral raise' }))

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Side' }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name: 'Left' }))

    fireEvent.click(screen.getByRole('button', { name: /save plan/i }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(put.mock.calls[0]![1]).toMatchObject({ exercise: 'shoulder_abduction', side: 'left' })
  })
})
