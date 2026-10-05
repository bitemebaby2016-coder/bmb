// ============================================
// FINAL CONFIG CLOSURE — server config → platform config projection (loader ONLY)
// ============================================
// Canonical sources (หน้าเดียวต่อค่า — ไม่สร้าง source ใหม่):
//   biteDriveMaxDistanceKm ← branches.service_radius_km (default branch, FC-3) else delivery_policy.bite_drive_radius_km
//   biteDriveEnabled       ← delivery_policy.bite_drive_enabled (FC-5 — server gate เดียวกัน)
//   tier2MarkupPct         ← delivery_policy.tier2_markup_pct (114)
//   freeShippingThreshold  ← delivery_policy.free_shipping_threshold (114)
//   cutoffHours            ← order_policy.cutoff_hours (FC-4 — enforce_pre_order_* อ่านอันเดียวกัน)
//   dailyQuota             ← order_policy.daily_quota (114)
//   currency               ← delivery_policy.currency
//   brandName/tenantId     ← brands default
//   theme (glass)          ← brands.theme_tokens.glass (114)
//   biteDriveFlatFee       ← delivery_zones ผ่าน fetchServerDeliveryFee (DistanceChecker ดึงตอนมีพิกัด)
// โหลด fail = เงียบ คง bootstrap fallback ไว้ (ค่า default = ค่า DB ปัจจุบัน)

import { getBusinessSettings } from './bmbAdminApi_settings'
import { supabase } from './supabase'
import {
  usePlatformConfigStore,
  DEFAULT_PLATFORM_CONFIG,
  type PlatformConfig,
  type GlassTheme,
} from '@/config/platformConfig'

export interface ConfigOverrides {
  tenantId?: string
  brandName?: string
  currency?: string
  theme?: GlassTheme
  delivery?: Partial<PlatformConfig['delivery']>
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Pure mapping — settings + default brand/branch rows → config overrides (missing = คง fallback). */
export function mapServerConfigToOverrides(
  settings: Record<string, unknown> | null | undefined,
  brand: { display_name?: string | null; name?: string | null; tenant_id?: string | null; theme_tokens?: Record<string, any> | null } | null | undefined,
  branch: { service_radius_km?: number | string | null } | null | undefined,
): ConfigOverrides {
  const overrides: ConfigOverrides = {}
  const dp = (settings?.delivery_policy ?? {}) as Record<string, unknown>
  const op = (settings?.order_policy ?? {}) as Record<string, unknown>
  const delivery: Partial<PlatformConfig['delivery']> = {}

  // FC-3: branch radius override ชนะ global (ค่า branch ปัจจุบัน = 5 = policy — พฤติกรรมเดิม)
  const branchRadius = num(branch?.service_radius_km)
  const policyRadius = num(dp.bite_drive_radius_km)
  const radius = branchRadius != null && branchRadius > 0 ? branchRadius : policyRadius
  if (radius != null && radius > 0) delivery.biteDriveMaxDistanceKm = radius

  if (dp.bite_drive_enabled != null) delivery.biteDriveEnabled = Boolean(dp.bite_drive_enabled)
  const markup = num(dp.tier2_markup_pct)
  if (markup != null && markup >= 0) delivery.tier2MarkupPct = markup
  const freeship = num(dp.free_shipping_threshold)
  if (freeship != null && freeship >= 0) delivery.freeShippingThreshold = freeship
  const cutoff = num(op.cutoff_hours)
  if (cutoff != null && cutoff >= 0) delivery.cutoffHours = cutoff
  const quota = num(op.daily_quota)
  if (quota != null && quota >= 0) delivery.dailyQuota = quota
  if (Object.keys(delivery).length > 0) overrides.delivery = delivery

  if (dp.currency != null && String(dp.currency).trim() !== '') overrides.currency = String(dp.currency)
  const brandName = brand?.display_name || brand?.name
  if (brandName && brandName.trim() !== '') overrides.brandName = brandName
  if (brand?.tenant_id) overrides.tenantId = brand.tenant_id

  const glass = (brand?.theme_tokens as Record<string, any> | null | undefined)?.glass
  if (glass && typeof glass === 'object') {
    overrides.theme = {
      ...DEFAULT_PLATFORM_CONFIG.theme,
      ...(glass.bg ? { glassBg: String(glass.bg) } : {}),
      ...(glass.blur ? { glassBlur: String(glass.blur) } : {}),
      ...(glass.border ? { glassBorder: String(glass.border) } : {}),
      ...(glass.text ? { glassText: String(glass.text) } : {}),
      ...(glass.shadow ? { depthShadow: String(glass.shadow) } : {}),
    }
  }
  return overrides
}

/** ยิงตอน boot (main.tsx) — ดึงค่าปกครองจาก server แล้วทับ config store. */
export async function hydratePlatformConfigFromServer(): Promise<void> {
  try {
    const [settings, brandRes, branchRes] = await Promise.all([
      getBusinessSettings(),
      supabase.from('brands').select('display_name, name, tenant_id, theme_tokens').eq('is_default', true).maybeSingle(),
      supabase.from('branches').select('service_radius_km').eq('is_default', true).eq('status', 'active').maybeSingle(),
    ])
    const brand = brandRes.error ? null : brandRes.data
    const branch = branchRes.error ? null : branchRes.data
    const overrides = mapServerConfigToOverrides(settings, brand, branch)
    const store = usePlatformConfigStore.getState()
    const hasIdentity = Boolean(overrides.brandName || overrides.currency || overrides.tenantId || overrides.theme)
    const hasDelivery = Boolean(overrides.delivery && Object.keys(overrides.delivery).length > 0)
    // setTenant rebuilds config from defaults → ต้อง setDeliveryOverrides ทีหลัง
    if (hasIdentity) {
      const identity: Partial<PlatformConfig> = {}
      if (overrides.brandName) identity.brandName = overrides.brandName
      if (overrides.currency) identity.currency = overrides.currency
      if (overrides.theme) identity.theme = overrides.theme
      store.setTenant(overrides.tenantId, identity)
    }
    if (hasDelivery) store.setDeliveryOverrides(overrides.delivery!)
  } catch {
    // เงียบ — bootstrap fallback ยังใช้งานได้
  }
}
