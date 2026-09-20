// ============================================
// Bite Me Baby — Reactive Delivery Router store tests
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useDeliveryRouter } from '@/stores/useDeliveryRouter'
import { usePlatformConfigStore } from '@/config/platformConfig'
import { DEFAULT_PLATFORM_CONFIG } from '@/config/platformConfig'

beforeEach(() => {
  useDeliveryRouter.getState().reset()
  usePlatformConfigStore.getState().setTenant()
})

describe('useDeliveryRouter — reactive two-tier hub', () => {
  it('evaluates a local drop to Bite Drive tier', () => {
    const r = useDeliveryRouter.getState()
    r.setDestination({ latitude: 12.61, longitude: 102.1 })
    r.evaluate()
    const quote = useDeliveryRouter.getState().quote
    expect(quote).not.toBeNull()
    expect(quote!.tier).toBe('bite_drive')
    expect(quote!.finalFee).toBe(DEFAULT_PLATFORM_CONFIG.delivery.biteDriveFlatFee)
  })

  it('evaluates a far drop to the third-party tier', () => {
    const r = useDeliveryRouter.getState()
    r.setOrigin({ latitude: 12.61, longitude: 102.1 }) // kitchen (Chanthaburi)
    r.setDestination({ latitude: 13.75, longitude: 100.5 }) // ~Bangkok
    r.evaluate()
    const quote = useDeliveryRouter.getState().quote
    expect(quote).not.toBeNull()
    expect(quote!.tier).toBe('third_party')
    expect(quote!.markup).toBeGreaterThan(0)
  })

  it('rejects a destination without finite coordinates', () => {
    const r = useDeliveryRouter.getState()
    r.setDestination({ latitude: Number.NaN, longitude: 5 })
    r.evaluate()
    expect(useDeliveryRouter.getState().quote).toBeNull()
  })
})
