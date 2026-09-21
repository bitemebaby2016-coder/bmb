// ============================================
// Bite Me Baby — Offline / retry utilities tests (PWA-02)
// ============================================

import { describe, it, expect } from 'vitest'
import { withRetry, isNetworkError } from '@/lib/offlineUtils'

describe('withRetry (PWA-02 — error/retry on critical flows)', () => {
  it('succeeds immediately on first attempt', async () => {
    let calls = 0
    const value = await withRetry(async () => {
      calls += 1
      return 'ok'
    })
    expect(value).toBe('ok')
    expect(calls).toBe(1)
  })

  it('retries a transient failure then succeeds', async () => {
    let calls = 0
    const attempts: number[] = []
    const value = await withRetry(async () => {
      calls += 1
      attempts.push(calls)
      if (calls < 3) throw new Error('network hiccup')
      return 'recovered'
    }, { retries: 3, baseDelayMs: 1, onRetry: (attempt) => attempts.push(-attempt) })
    expect(value).toBe('recovered')
    expect(calls).toBe(3)
  })

  it('gives up after N retries', async () => {
    let calls = 0
    await expect(
      withRetry(async () => {
        calls += 1
        throw new Error('persistent')
      }, { retries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('persistent')
    expect(calls).toBe(3) // 1 + 2 retries
  })
})

describe('isNetworkError (PWA-02 — offline detection heuristic)', () => {
  it('recognises transport-level failures', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('network connection lost'))).toBe(true)
    expect(isNetworkError('fetch failed')).toBe(true)
  })

  it('does not flag business errors as network errors', () => {
    expect(isNetworkError(new Error('ERR_CAPACITY_FULL'))).toBe(false)
    expect(isNetworkError('No rows')).toBe(false)
  })
})