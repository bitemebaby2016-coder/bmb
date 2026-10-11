// ============================================
// Bite Me Baby — CR-2 P1 manual pin parser (DeliveryMapPicker) tests
// ============================================

import { describe, it, expect } from 'vitest'
import { parseManualPin } from '@/components/delivery/DeliveryMapPicker'

describe('parseManualPin (manual lat/lng fallback when maps unavailable)', () => {
  it('accepts valid WGS84 pairs', () => {
    expect(parseManualPin('12.6096', '102.1039')).toEqual({ lat: 12.6096, lng: 102.1039 })
    expect(parseManualPin(' 10.7016 ', ' 102.1429 ')).toEqual({ lat: 10.7016, lng: 102.1429 })
    expect(parseManualPin('-33.8688', '151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 })
  })

  it('rejects empty / non-numeric input', () => {
    expect(parseManualPin('', '')).toBeNull()
    expect(parseManualPin('abc', '102.1')).toBeNull()
    expect(parseManualPin('12.6', 'xyz')).toBeNull()
    expect(parseManualPin('NaN', 'NaN')).toBeNull()
  })

  it('rejects out-of-range coordinates', () => {
    expect(parseManualPin('91', '102.1')).toBeNull()
    expect(parseManualPin('12.6', '181')).toBeNull()
  })

  it('rejects the 0,0 null island placeholder', () => {
    expect(parseManualPin('0', '0')).toBeNull()
  })
})
