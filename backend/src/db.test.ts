import { describe, expect, it, vi } from 'vitest'
import { connectWithRetry, describeUri, splitSslMode } from './db.ts'

describe('describeUri', () => {
  it('masks the password and nothing else', () => {
    expect(describeUri('postgres://tsdbadmin:s3cr3t@abc.tsdb.cloud.timescale.com:30133/tsdb?sslmode=require')).toBe(
      'postgres://tsdbadmin:***@abc.tsdb.cloud.timescale.com:30133/tsdb?sslmode=require',
    )
    expect(describeUri('postgres://127.0.0.1:5432/arc')).toBe('postgres://127.0.0.1:5432/arc')
  })
})

describe('splitSslMode', () => {
  it('turns sslmode=require into encryption without certificate checks and removes it from the URL', () => {
    expect(splitSslMode('postgres://u:p@h.example.com:30133/tsdb?sslmode=require')).toEqual({
      connectionString: 'postgres://u:p@h.example.com:30133/tsdb',
      ssl: { rejectUnauthorized: false },
    })
  })

  it('verifies certificates for verify-full and keeps other query parameters', () => {
    expect(splitSslMode('postgres://u:p@h.example.com/tsdb?application_name=arc&sslmode=verify-full')).toEqual({
      connectionString: 'postgres://u:p@h.example.com/tsdb?application_name=arc',
      ssl: { rejectUnauthorized: true },
    })
  })

  it('is plain for local hosts and disable, encrypted for remote hosts without an sslmode', () => {
    expect(splitSslMode('postgres://127.0.0.1:54329/arc').ssl).toBe(false)
    expect(splitSslMode('postgres://u:p@h.example.com/tsdb?sslmode=disable').ssl).toBe(false)
    expect(splitSslMode('postgres://u:p@h.example.com/tsdb').ssl).toEqual({ rejectUnauthorized: false })
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
