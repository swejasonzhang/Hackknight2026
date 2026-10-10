import type { CreateSessionInput } from '@arc/dependencies'
import { describe, expect, it, vi } from 'vitest'
import { SessionSaver } from './saver'

const input = (sets: number, complete: boolean) => ({ profileId: 'p1', sets: Array.from({ length: sets }), complete }) as unknown as CreateSessionInput

describe('SessionSaver', () => {
  it('creates the session with the first set, then updates that one session with every later save', async () => {
    const create = vi.fn().mockResolvedValue({ id: 's1' })
    const update = vi.fn().mockResolvedValue({ id: 's1' })
    const saver = new SessionSaver({ create, update })
    expect(await saver.save(input(1, false))).toBe('s1')
    expect(await saver.save(input(2, false))).toBe('s1')
    expect(await saver.save(input(2, true))).toBe('s1')
    expect(create).toHaveBeenCalledTimes(1)
    expect(update.mock.calls.map(([id, body]) => [id, body.sets.length, body.complete])).toEqual([
      ['s1', 2, false],
      ['s1', 2, true],
    ])
  })

  it('runs saves one after another, so a quick second set never creates a second session', async () => {
    let finishCreate!: (v: { id: string }) => void
    const create = vi.fn().mockImplementation(() => new Promise((r) => (finishCreate = r)))
    const update = vi.fn().mockResolvedValue({ id: 's1' })
    const saver = new SessionSaver({ create, update })
    const first = saver.save(input(1, false))
    const second = saver.save(input(2, false))
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(update).not.toHaveBeenCalled() // the second save waits for the first
    finishCreate({ id: 's1' })
    await Promise.all([first, second])
    expect(create).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith('s1', expect.objectContaining({ complete: false }))
  })

  it('a failed save is made up by the next one, which carries every set so far', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 's1' })
    const update = vi.fn().mockResolvedValue({ id: 's1' })
    const saver = new SessionSaver({ create, update })
    await expect(saver.save(input(1, false))).rejects.toThrow('offline')
    expect(saver.savedId).toBeNull()
    expect(await saver.save(input(2, true))).toBe('s1')
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ complete: true }))
  })
})
