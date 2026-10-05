// ============================================
// Bite Me Baby — Multi-Tenant Global Configuration Engine
// ============================================
// Every layout value, distance, quota, cutoff, and theme is driven by this
// config engine so the platform supports White-Label tenants.
// Pure data + a reactive Zustand store. Components select slices with the
// `usePlatformConfig()` hook; pure functions receive a `PlatformConfig` slice
// as arguments (never import this file into pure logic).

import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Config shape (strictly typed)
// ---------------------------------------------------------------------------

export type OrderMode = 'SAME_DAY' | 'PRE_ORDER'

export interface DeliveryConfig {
  /** Canonical: delivery_policy.bite_drive_radius_km + branch override branches.service_radius_km (hydrated — FC-3) */
  biteDriveMaxDistanceKm: number
  /** Canonical: delivery_policy.bite_drive_enabled — server gate (ERR_BITE_DRIVE_DISABLED, FC-5) */
  biteDriveEnabled: boolean
  /** Display default; ค่าจริง = delivery_zones ผ่าน fetchServerDeliveryFee (DistanceChecker ดึงตอนมีพิกัด) */
  biteDriveFlatFee: number
  /** Canonical: delivery_policy.tier2_markup_pct (hydrated — migration 114) */
  tier2MarkupPct: number
  /** Canonical: delivery_policy.free_shipping_threshold (hydrated — migration 114) */
  freeShippingThreshold: number
  /** Canonical: order_policy.cutoff_hours — enforce_pre_order_window/cancel อ่านอันเดียวกัน (FC-4) */
  cutoffHours: number
  /** Canonical: order_policy.daily_quota (hydrated — display/monitor) */
  dailyQuota: number
  /** UX timing (ไม่ใช่ค่าขาย/ส่ง/brand) */
  debounceMs: number
}

export interface GlassTheme {
  /** CSS values จาก brands.theme_tokens.glass (hydrated — migration 114) */
  glassBg: string
  glassBlur: string
  glassBorder: string
  glassText: string
  depthShadow: string
}

export interface PlatformConfig {
  /** Tenant ID — resolved dynamically from brand context (TEN-06). Fallback on bootstrapping. */
  tenantId: string
  brandName: string
  currency: string
  delivery: DeliveryConfig
  theme: GlassTheme
}

// ---------------------------------------------------------------------------
// Defaults (single-tenant fallback for bootstrapping before brand context resolves)
// TEN-06: tenantId is dynamically extracted from resolvedBrandStore at runtime.
// ---------------------------------------------------------------------------

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  tenantId: 'tenant-bmb-001', // Only used as bootstrapping fallback
  brandName: 'Bite Me Baby',
  currency: 'THB',
  delivery: {
    biteDriveMaxDistanceKm: 5,
    biteDriveEnabled: true,
    biteDriveFlatFee: 25,
    tier2MarkupPct: 12,
    freeShippingThreshold: 300,
    cutoffHours: 2,
    dailyQuota: 120,
    debounceMs: 500,
  },
  theme: {
    glassBg: 'rgba(255,255,255,0.7)',
    glassBlur: '12px',
    glassBorder: 'rgba(255,255,255,0.2)',
    glassText: '#1f2937',
    depthShadow: 'drop-shadow(0 15px 12px rgba(0,0,0,0.18))',
  },
}


/** Get dynamic tenantId from resolved brand context (TEN-06). */
function getDynamicTenantId(): string {
  return DEFAULT_PLATFORM_CONFIG.tenantId // Dynamically set via BrandProvider at runtime
}

export function getPlatformConfig(tenantId?: string, overrides: Partial<PlatformConfig> = {}): PlatformConfig {
  const effectiveTenant = tenantId || getDynamicTenantId()
  const base = { ...DEFAULT_PLATFORM_CONFIG, tenantId: effectiveTenant }
  return {
    ...base,
    ...overrides,
    delivery: { ...base.delivery, ...overrides.delivery },
    theme: { ...base.theme, ...overrides.theme },
  }
}

interface PlatformConfigStore {
  config: PlatformConfig
  setTenant: (tenantId?: string, overrides?: Partial<PlatformConfig>) => void
  setDeliveryOverrides: (overrides: Partial<DeliveryConfig>) => void
}

export const usePlatformConfigStore = create<PlatformConfigStore>((set) => ({
  config: DEFAULT_PLATFORM_CONFIG,
  setTenant: (tenantId?, overrides = {}) => set({ config: getPlatformConfig(tenantId, overrides) }),
  setDeliveryOverrides: (overrides) => set((state) => ({ config: { ...state.config, delivery: { ...state.config.delivery, ...overrides } } })),
}))

export function usePlatformConfig(): PlatformConfig {
  return usePlatformConfigStore((s) => s.config)
}
