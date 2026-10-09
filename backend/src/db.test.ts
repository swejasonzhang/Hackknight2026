import { describe, expect, it, vi } from 'vitest'
import { connectWithRetry, describeUri } from './db.ts'

describe('describeUri', () => {
  it('masks the password and nothing else', () => {
    expect(describeUri('mongodb+srv://ada:s3cr3t@cluster0.example.net/ptg?x=1')).toBe('mongodb+srv://ada:***@cluster0.example.net/ptg?x=1')
    expect(describeUri('mongodb://127.0.0.1:27017/ptg')).toBe('mongodb://127.0.0.1:27017/ptg')
  })
})

describe('connectWithRetry', () => {
  it('returns the first successful result without sleeping', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const connect = vi.fn().mockResolvedValue('ok')
    await expect(connectWithRetry(connect, { maxAttempts: 3, delayMs: 10, sleep })).resolves.toBe('ok')
    expect(connect).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries after a failure, reports each failure, and succeeds when the database appears', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const onError = vi.fn()
    const connect = vi.fn().mockRejectedValueOnce(new Error('refused')).mockRejectedValueOnce(new Error('refused')).mockResolvedValue('ok')
    await expect(connectWithRetry(connect, { maxAttempts: 5, delayMs: 10, sleep, onError })).resolves.toBe('ok')
    expect(connect).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(10)
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenLastCalledWith(expect.any(Error), 2, 5)
  })

  it('gives up with the last error after maxAttempts', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const connect = vi.fn().mockRejectedValue(new Error('still refused'))
    await expect(connectWithRetry(connect, { maxAttempts: 3, delayMs: 10, sleep })).rejects.toThrow('still refused')
    expect(connect).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('retries forever when maxAttempts is Infinity', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    let calls = 0
    const connect = vi.fn().mockImplementation(() => (++calls < 25 ? Promise.reject(new Error('no')) : Promise.resolve('ok')))
    await expect(connectWithRetry(connect, { maxAttempts: Infinity, delayMs: 1, sleep })).resolves.toBe('ok')
    expect(connect).toHaveBeenCalledTimes(25)
  })
})
