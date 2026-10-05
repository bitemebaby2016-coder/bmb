// ============================================
// W-1.4b — Server config → platform config projection (loader ONLY)
// ============================================
// Canonical sources (หน้าเดียวต่อค่า — ห้ามสร้าง source ใหม่):
//   biteDriveMaxDistanceKm ← business_settings.delivery_policy.bite_drive_radius_km
//   currency               ← business_settings.delivery_policy.currency
//   brandName              ← brands.display_name (default brand)
//   tenantId               ← brands.tenant_id (default brand)
//   biteDriveFlatFee       ← delivery_zones ผ่าน fetchServerDeliveryFee (DistanceChecker ดึงตอนมีพิกัด)
// HARD STOP — ไม่มี schema ใน DB (ค่าคง fallback เดิม รายงาน Owner แล้ว):
//   tier2MarkupPct · freeShippingThreshold · cutoffHours · dailyQuota · theme.glass*
// โหลด fail = เงียบ คง bootstrap fallback ไว้ (ค่า default ตรงค่า DB ปัจจุบัน)

import { getBusinessSettings } from './bmbAdminApi_settings'
import { supabase } from './supabase'
import { usePlatformConfigStore, type PlatformConfig } from '@/config/platformConfig'

export interface ConfigOverrides {
  tenantId?: string
  brandName?: string
  currency?: string
  delivery?: Partial<PlatformConfig['delivery']>
}

/** Pure mapping — settings + default brand row → config overrides (undefined = คง fallback). */
export function mapServerConfigToOverrides(
  settings: Record<string, unknown> | null | undefined,
  brand: { display_name?: string | null; name?: string | null; tenant_id?: string | null } | null | undefined,
): ConfigOverrides {
  const overrides: ConfigOverrides = {}
  const dp = (settings?.delivery_policy ?? {}) as Record<string, unknown>

  const radius = Number(dp.bite_drive_radius_km)
  if (dp.bite_drive_radius_km != null && Number.isFinite(radius) && radius > 0) {
    overrides.delivery = { ...overrides.delivery, biteDriveMaxDistanceKm: radius }
  }
  if (dp.currency != null && String(dp.currency).trim() !== '') {
    overrides.currency = String(dp.currency)
  }
  const brandName = brand?.display_name || brand?.name
  if (brandName && brandName.trim() !== '') overrides.brandName = brandName
  if (brand?.tenant_id) overrides.tenantId = brand.tenant_id
  return overrides
}

/** ยิงตอน boot (main.tsx) — ดึงค่าปกครองจาก server แล้วทับ config store. */
export async function hydratePlatformConfigFromServer(): Promise<void> {
  try {
    const [settings, brandRes] = await Promise.all([
      getBusinessSettings(),
      supabase.from('brands').select('display_name, name, tenant_id').eq('is_default', true).maybeSingle(),
    ])
    const brand = brandRes.error ? null : brandRes.data
    const overrides = mapServerConfigToOverrides(settings, brand)
    const store = usePlatformConfigStore.getState()
    const hasIdentity = Boolean(overrides.brandName || overrides.currency || overrides.tenantId)
    const hasDelivery = Boolean(overrides.delivery && Object.keys(overrides.delivery).length > 0)
    // setTenant rebuilds config from defaults → ต้อง setDeliveryOverrides ทีหลัง
    if (hasIdentity) {
      const identity: Partial<PlatformConfig> = {}
      if (overrides.brandName) identity.brandName = overrides.brandName
      if (overrides.currency) identity.currency = overrides.currency
      store.setTenant(overrides.tenantId, identity)
    }
    if (hasDelivery) store.setDeliveryOverrides(overrides.delivery!)
  } catch {
    // เงียบ — bootstrap fallback ยังใช้งานได้
  }
}
