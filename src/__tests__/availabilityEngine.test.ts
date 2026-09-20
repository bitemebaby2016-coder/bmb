// ============================================
// Bite Me Baby — Truth Table Engine tests (quota + cutoff)
// ============================================

import { describe, it, expect } from 'vitest'
import { isOrderAvailable, isSlotAvailable, isNearQuota } from '@/lib/availabilityEngine'

describe('availabilityEngine — Truth Table (quota & cutoff)', () => {
  const now = '2026-09-20T10:00:00.000Z'
  const fourHoursAhead = '2026-09-20T14:00:00.000Z'

  it('is available when quota is open and target is far enough ahead', () => {
    const r = isOrderAvailable({
      currentOrders: 10,
      dailyQuota: 100,
      targetDeliveryTime: fourHoursAhead,
      currentTime: now,
      cutoffHours: 2,
    })
    expect(r.isAvailable).toBe(true)
    expect(r.reason).toBe('available')
    expect(r.hoursRemaining).toBeCloseTo(4, 5)
  })

  it('blocks when the daily quota ceiling is reached (quota_full)', () => {
    const r = isOrderAvailable({
      currentOrders: 100,
      dailyQuota: 100,
      targetDeliveryTime: fourHoursAhead,
      currentTime: now,
      cutoffHours: 2,
    })
    expect(r.isAvailable).toBe(false)
    expect(r.reason).toBe('quota_full')
  })

  it('blocks when the cutoff lead time is not met (cutoff_passed)', () => {
    const r = isOrderAvailable({
      currentOrders: 10,
      dailyQuota: 100,
      targetDeliveryTime: '2026-09-20T11:00:00.000Z', // only 1h ahead < 2h cutoff
      currentTime: now,
      cutoffHours: 2,
    })
    expect(r.isAvailable).toBe(false)
    expect(r.reason).toBe('cutoff_passed')
    expect(r.hoursRemaining).toBeLessThan(2)
  })

  it('convenience helper matches the boolean contract', () => {
    expect(isSlotAvailable(10, 100, fourHoursAhead, 2, now)).toBe(true)
    expect(isSlotAvailable(100, 100, fourHoursAhead, 2, now)).toBe(false)
  })

  it('warns when the quota is near the ceiling', () => {
    expect(isNearQuota(95, 100)).toBe(true)
    expect(isNearQuota(40, 100)).toBe(false)
    expect(isNearQuota(0, 0)).toBe(false)
  })
})
