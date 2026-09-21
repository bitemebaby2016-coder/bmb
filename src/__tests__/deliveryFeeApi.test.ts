// ============================================
// Bite Me Baby — Phase 3 DEL-01 authoritative delivery-fee tests
// ============================================

import { describe, it, expect } from 'vitest'
import { zoneFeeForDistance, localZoneFee, SEEDED_DELIVERY_ZONES } from '@/lib/deliveryFeeApi'

describe('zoneFeeForDistance (DEL-01 — fee จาก delivery_zones)', () => {
  it('picks the zone that contains the distance', () => {
    expect(zoneFeeForDistance(3)).toBe(25)
    expect(zoneFeeForDistance(5)).toBe(25) // inclusive min of next zone boundary handled by ordering
    expect(zoneFeeForDistance(7)).toBe(45)
    expect(zoneFeeForDistance(15)).toBe(80)
  })

  it('returns null when no zone covers the distance', () => {
    expect(zoneFeeForDistance(50)).toBeNull()
    expect(zoneFeeForDistance(-1)).toBeNull()
  })

  it('honours is_active=false zones (admin disables a zone → fallthrough to next)', () => {
    const zones = SEEDED_DELIVERY_ZONES.map((z) => (z.id === 'zone-city' ? { ...z, is_active: false } : z))
    // city (0-5) disabled → a 6 km drop falls into suburb (5-10)
    expect(zoneFeeForDistance(6, zones)).toBe(45)
    // and the disabled city band is NOT served anymore
    expect(zoneFeeForDistance(2, zones)).toBeNull()
  })
})

describe('localZoneFee (DEL-01 — offline mirror)', () => {
  it('computes server-style fee from drop-off coordinates', () => {
    // near the default kitchen (10.7016,102.1429)
    const near = localZoneFee({ dropoffLatitude: 10.71, dropoffLongitude: 102.15 })
    // ~1 km away → zone-city (25 THB)
    expect(near).toBe(25)
  })

  it('uses the supplied distance when coordinates are absent', () => {
    expect(localZoneFee({ distanceKm: 8 })).toBe(45)
  })
})