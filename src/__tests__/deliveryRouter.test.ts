// ============================================
// Bite Me Baby — Hybrid Delivery Router (Two-Tier) tests
// ============================================

import { describe, it, expect } from 'vitest'
import { routeOrder, haversineDistanceKm, estimateExternalQuote, type RoutingQuote } from '@/lib/deliveryRouter'
import { DEFAULT_PLATFORM_CONFIG } from '@/config/platformConfig'

const DELIVERY = DEFAULT_PLATFORM_CONFIG.delivery

describe('deliveryRouter — Tier 1 Bite Drive (≤ max distance)', () => {
  it('routes a 3km drop to the own fleet with the flat fee and zero markup', () => {
    const q: RoutingQuote = routeOrder({ distanceKm: 3, to: { latitude: 0, longitude: 0 }, delivery: DELIVERY })
    expect(q.tier).toBe('bite_drive')
    expect(q.finalFee).toBe(DELIVERY.biteDriveFlatFee)
    expect(q.markup).toBe(0)
    expect(q.executorFee).toBe(DELIVERY.biteDriveFlatFee)
    expect(q.distanceKm).toBe(3)
  })

  it('treats a drop exactly at the boundary distance as Bite Drive', () => {
    const q = routeOrder({
      distanceKm: DELIVERY.biteDriveMaxDistanceKm,
      to: { latitude: 0, longitude: 0 },
      delivery: DELIVERY,
    })
    expect(q.tier).toBe('bite_drive')
  })
})

describe('deliveryRouter — Tier 2 third-party (beyond max distance)', () => {
  it('injects the platform markup on top of the real-time external quote', () => {
    const external = 120
    const q = routeOrder({
      distanceKm: 12,
      to: { latitude: 0, longitude: 0 },
      delivery: DELIVERY,
      externalQuote: external,
    })
    expect(q.tier).toBe('third_party')
    expect(q.executorFee).toBe(external)
    expect(q.markup).toBeCloseTo(external * (DELIVERY.tier2MarkupPct / 100), 5)
    expect(q.finalFee).toBeCloseTo(external + q.markup, 5)
  })

  it('falls back to an estimator fee when no external quote is supplied', () => {
    const q = routeOrder({ distanceKm: 20, to: { latitude: 0, longitude: 0 }, delivery: DELIVERY })
    expect(q.tier).toBe('third_party')
    expect(q.executorFee).toBe(estimateExternalQuote(20))
  })
})

describe('deliveryRouter — geometry', () => {
  it('Haversine returns ~0 for identical coordinates', () => {
    expect(haversineDistanceKm(12.61, 102.1, 12.61, 102.1)).toBeCloseTo(0, 5)
  })

  it('Haversine computes a plausible cross-city distance', () => {
    // Chanthaburi (~12.61,102.10) -> Bangkok (~13.75,100.50) is roughly 200-220 km.
    const d = haversineDistanceKm(12.61, 102.1, 13.75, 100.5)
    expect(d).toBeGreaterThan(190)
    expect(d).toBeLessThan(230)
  })
})
