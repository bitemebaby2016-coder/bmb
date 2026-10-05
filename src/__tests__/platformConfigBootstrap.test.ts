// ============================================
// W-1.4b — mapServerConfigToOverrides (pure projection) tests
// ============================================
import { describe, it, expect } from 'vitest'
import { mapServerConfigToOverrides } from '@/lib/platformConfigBootstrap'
import { DEFAULT_PLATFORM_CONFIG } from '@/config/platformConfig'

describe('mapServerConfigToOverrides — server → client config projection', () => {
  it('maps delivery_policy.bite_drive_radius_km → biteDriveMaxDistanceKm', () => {
    const o = mapServerConfigToOverrides({ delivery_policy: { bite_drive_radius_km: 3.5, currency: 'THB' } }, null)
    expect(o.delivery?.biteDriveMaxDistanceKm).toBe(3.5)
    expect(o.currency).toBe('THB')
  })

  it('maps default brand → brandName + tenantId', () => {
    const o = mapServerConfigToOverrides(null, { display_name: 'Chanthaburi Kitchen', name: 'X', tenant_id: 'tenant-2' })
    expect(o.brandName).toBe('Chanthaburi Kitchen')
    expect(o.tenantId).toBe('tenant-2')
  })

  it('returns empty overrides when nothing is available (fallback preserved)', () => {
    expect(mapServerConfigToOverrides(null, null)).toEqual({})
    expect(mapServerConfigToOverrides({}, null)).toEqual({})
  })

  it('ignores invalid radius (non-numeric / <= 0) instead of corrupting config', () => {
    expect(mapServerConfigToOverrides({ delivery_policy: { bite_drive_radius_km: 'abc' } }, null)).toEqual({})
    expect(mapServerConfigToOverrides({ delivery_policy: { bite_drive_radius_km: -1 } }, null)).toEqual({})
    expect(mapServerConfigToOverrides({ delivery_policy: { bite_drive_radius_km: 0 } }, null)).toEqual({})
  })

  it('never touches HARD STOP keys (no schema in DB) — fallback defaults stay', () => {
    const o = mapServerConfigToOverrides(
      { delivery_policy: { bite_drive_radius_km: 5, tier2_markup_pct: 99, free_shipping_threshold: 999 } },
      null,
    )
    expect(o.delivery).toEqual({ biteDriveMaxDistanceKm: 5 })
    expect(DEFAULT_PLATFORM_CONFIG.delivery.tier2MarkupPct).toBe(12)
    expect(DEFAULT_PLATFORM_CONFIG.delivery.freeShippingThreshold).toBe(300)
  })

  it('falls back to brand.name when display_name is empty', () => {
    const o = mapServerConfigToOverrides(null, { display_name: '', name: 'Fallback Brand', tenant_id: null })
    expect(o.brandName).toBe('Fallback Brand')
    expect(o.tenantId).toBeUndefined()
  })
})
