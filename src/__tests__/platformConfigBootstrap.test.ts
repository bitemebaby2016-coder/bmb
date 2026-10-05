// ============================================
// mapServerConfigToOverrides (pure projection) tests — FINAL CONFIG CLOSURE
// ============================================
import { describe, it, expect } from 'vitest'
import { mapServerConfigToOverrides } from '@/lib/platformConfigBootstrap'
import { DEFAULT_PLATFORM_CONFIG } from '@/config/platformConfig'

const SETTINGS = {
  delivery_policy: {
    currency: 'THB',
    bite_drive_radius_km: 5,
    bite_drive_enabled: true,
    tier2_markup_pct: 12,
    free_shipping_threshold: 300,
  },
  order_policy: { cutoff_hours: 2, daily_quota: 120 },
}

describe('mapServerConfigToOverrides — server → client config projection', () => {
  it('maps all delivery/order canonical fields', () => {
    const o = mapServerConfigToOverrides(SETTINGS, null, null)
    expect(o.delivery?.biteDriveMaxDistanceKm).toBe(5)
    expect(o.delivery?.biteDriveEnabled).toBe(true)
    expect(o.delivery?.tier2MarkupPct).toBe(12)
    expect(o.delivery?.freeShippingThreshold).toBe(300)
    expect(o.delivery?.cutoffHours).toBe(2)
    expect(o.delivery?.dailyQuota).toBe(120)
    expect(o.currency).toBe('THB')
  })

  it('branch service_radius_km overrides global policy radius (FC-3)', () => {
    const o = mapServerConfigToOverrides(SETTINGS, null, { service_radius_km: 3.5 })
    expect(o.delivery?.biteDriveMaxDistanceKm).toBe(3.5)
  })

  it('invalid branch radius (<=0/non-numeric) falls back to policy radius', () => {
    expect(mapServerConfigToOverrides(SETTINGS, null, { service_radius_km: 0 }).delivery?.biteDriveMaxDistanceKm).toBe(5)
    expect(mapServerConfigToOverrides(SETTINGS, null, { service_radius_km: 'abc' }).delivery?.biteDriveMaxDistanceKm).toBe(5)
  })

  it('bite_drive_enabled=false ถูกส่งต่อ (server gate เดียวกัน)', () => {
    const s = { delivery_policy: { ...SETTINGS.delivery_policy, bite_drive_enabled: false } }
    expect(mapServerConfigToOverrides(s, null, null).delivery?.biteDriveEnabled).toBe(false)
  })

  it('maps brand name/tenant + theme glass tokens', () => {
    const o = mapServerConfigToOverrides(null, {
      display_name: 'Chanthaburi Kitchen',
      name: 'X',
      tenant_id: 'tenant-2',
      theme_tokens: { glass: { bg: 'rgba(1,2,3,0.5)', blur: '4px', shadow: 'drop-shadow(0 0 1px red)' } },
    }, null)
    expect(o.brandName).toBe('Chanthaburi Kitchen')
    expect(o.tenantId).toBe('tenant-2')
    expect(o.theme?.glassBg).toBe('rgba(1,2,3,0.5)')
    expect(o.theme?.glassBlur).toBe('4px')
    expect(o.theme?.depthShadow).toBe('drop-shadow(0 0 1px red)')
    // ค่าที่ไม่ได้ระบุ = fallback default
    expect(o.theme?.glassBorder).toBe(DEFAULT_PLATFORM_CONFIG.theme.glassBorder)
  })

  it('returns empty overrides when nothing is available (fallback preserved)', () => {
    expect(mapServerConfigToOverrides(null, null, null)).toEqual({})
    expect(mapServerConfigToOverrides({}, null, null)).toEqual({})
  })

  it('ignores invalid numbers instead of corrupting config', () => {
    const s = { delivery_policy: { bite_drive_radius_km: 'abc', tier2_markup_pct: -5 }, order_policy: { cutoff_hours: 'x' } }
    const o = mapServerConfigToOverrides(s, null, null)
    expect(o.delivery?.biteDriveMaxDistanceKm).toBeUndefined()
    expect(o.delivery?.tier2MarkupPct).toBeUndefined()
    expect(o.delivery?.cutoffHours).toBeUndefined()
  })

  it('unknown keys in settings are never projected (ไม่มี key ซ้ำ/ใหม่หลุดเข้า config)', () => {
    const s = { delivery_policy: { ...SETTINGS.delivery_policy, some_future_key: 999 } }
    const o = mapServerConfigToOverrides(s, null, null)
    expect(Object.keys(o.delivery ?? {})).toEqual(
      expect.arrayContaining(['biteDriveMaxDistanceKm', 'biteDriveEnabled', 'tier2MarkupPct', 'freeShippingThreshold']),
    )
    expect(JSON.stringify(o)).not.toContain('some_future_key')
  })

  it('falls back to brand.name when display_name is empty', () => {
    const o = mapServerConfigToOverrides(null, { display_name: '', name: 'Fallback Brand', tenant_id: null }, null)
    expect(o.brandName).toBe('Fallback Brand')
    expect(o.tenantId).toBeUndefined()
  })
})
