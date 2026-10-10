import { EMAIL_REQUIREMENT, NAME_REQUIREMENT } from '@arc/dependencies'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const reload = vi.fn()
const setSelectedId = vi.fn()
vi.mock('../api/client', () => ({ api: { profiles: { create: (input: unknown) => create(input), remove: vi.fn(), seedDemo: vi.fn() } } }))
vi.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ reload, setSelectedId, profiles: [], selected: null, selectedId: '', loading: false, error: null }) }))
const { ProfilesPage } = await import('./ProfilesPage')

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProfilesPage />
    </MemoryRouter>,
  )
const name = () => screen.getByLabelText(/^name/i)
const email = () => screen.getByLabelText(/^email/i)
const add = () => screen.getByRole('button', { name: /add profile/i })

describe('ProfilesPage new entry', () => {
  beforeEach(() => {
    create.mockReset()
    reload.mockReset()
  })

  it('states what the name and email need, and marks email optional', () => {
    renderPage()
    expect(name()).toHaveAccessibleDescription(NAME_REQUIREMENT)
    expect(email()).toHaveAccessibleDescription(`Optional. ${EMAIL_REQUIREMENT}`)
    expect(add()).toBeDisabled()
  })

  it('will not add a name with digits or a half-typed email, and says why', () => {
    renderPage()
    fireEvent.change(name(), { target: { value: 'Ada99' } })
    fireEvent.blur(name())
    expect(name()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Use only letters, spaces, apostrophes, hyphens or periods.')).toBeInTheDocument()
    expect(add()).toBeDisabled()
    fireEvent.change(name(), { target: { value: 'Ada' } })
    expect(add()).toBeEnabled()
    fireEvent.change(email(), { target: { value: 'ada@' } })
    fireEvent.blur(email())
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(add()).toBeDisabled()
  })

  it('adds a valid profile with the name trimmed and no email when it is left empty', async () => {
    create.mockResolvedValue({ id: 'p1', name: 'Ada Lovelace' })
    renderPage()
    fireEvent.change(name(), { target: { value: '  Ada Lovelace ' } })
    fireEvent.click(add())
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Ada Lovelace', email: undefined }))
    expect(await screen.findByText('Added Ada Lovelace.')).toBeInTheDocument()
  })
})
