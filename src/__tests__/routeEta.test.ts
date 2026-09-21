// ============================================
// Bite Me Baby — Phase 3 DEL-04 route ETA accuracy tests
// ============================================

import { describe, it, expect } from 'vitest'
import {
  ETA_ACCURACY_TOLERANCE_MIN,
  etaAccuracySummary,
  calibratedEtaMinutes,
  estimateDeliveryTime,
} from '@/lib/routeOptimization'

describe('etaAccuracySummary (DEL-04 — tolerance ≤ 15 นาที/จุด)', () => {
  it('flags within-tolerance when every stop error ≤ 15 min', () => {
    const summary = etaAccuracySummary([
      { estimated: 30, actual: 28 },
      { estimated: 40, actual: 47 },
      { estimated: 22, actual: 26 },
    ])
    expect(summary.withinTolerance).toBe(true)
    expect(summary.maxErrorMinutes).toBeLessThanOrEqual(ETA_ACCURACY_TOLERANCE_MIN)
  })

  it('flags out-of-tolerance when any stop exceeds 15 min error', () => {
    const summary = etaAccuracySummary([
      { estimated: 25, actual: 20 },
      { estimated: 45, actual: 62 }, // 17 min off
    ])
    expect(summary.withinTolerance).toBe(false)
    expect(summary.maxErrorMinutes).toBe(17)
  })

  it('empty reports = within tolerance (no data yet)', () => {
    expect(etaAccuracySummary([]).withinTolerance).toBe(true)
  })
})

describe('calibratedEtaMinutes (DEL-04 — learn from actual times)', () => {
  it('falls back to the stock heuristic without history', () => {
    expect(calibratedEtaMinutes(10, 2)).toBe(estimateDeliveryTime(10, 2))
  })

  it('uses observed minutes-per-km when samples exist', () => {
    // observed ~2.2 min/km average
    const eta = calibratedEtaMinutes(10, 0, [2.1, 2.3, 2.2])
    expect(eta).toBe(22)
  })
})