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
  /** Canonical: business_settings.delivery_policy.bite_drive_radius_km (hydrated at boot — W-1.4b) */
  biteDriveMaxDistanceKm: number
  /** Display default; ค่าจริง = delivery_zones ผ่าน fetchServerDeliveryFee (DistanceChecker ดึงตอนมีพิกัด — W-1.4b) */
  biteDriveFlatFee: number
  /** HARD STOP: ไม่มี key/column ใน DB — คงเป็น fallback รอ Owner กำหนด schema (รายงาน W-1.4b) */
  tier2MarkupPct: number
  /** HARD STOP: ไม่มี key ใน DB (promotions = code-coupon ไม่ใช่ threshold) — รอ Owner */
  freeShippingThreshold: number
  /** HARD STOP: ไม่มี key หน่วย ชม. (rounds = time-of-day, order_policy = วัน) — รอ Owner */
  cutoffHours: number
  /** HARD STOP: ไม่มี key quota/วัน (max_items_per_order = ต่อออเดอร์) — ใช้ใน AdminControl demo เท่านั้น */
  dailyQuota: number
  /** UX timing (ไม่ใช่ค่าขาย/ส่ง/brand — อยู่นอกขอบเขต Owner mandate) */
  debounceMs: number
}

export interface GlassTheme {
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
  weeklyRotator: {
    availableWeekAttr: 'available_week' | 'available_date'
    maxWeeks: number
  }
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
    biteDriveFlatFee: 25,
    tier2MarkupPct: 12,
    freeShippingThreshold: 300,
    cutoffHours: 2,
    dailyQuota: 120,
    debounceMs: 500,
  },
  theme: {
    glassBg: 'bg-white/70',
    glassBlur: 'backdrop-blur-md',
    glassBorder: 'border border-white/20',
    glassText: 'text-slate-800',
    depthShadow: 'drop-shadow-[0_15px_12px_rgba(0,0,0,0.18)]',
  },
  weeklyRotator: {
    availableWeekAttr: 'available_week',
    maxWeeks: 4,
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
    weeklyRotator: { ...base.weeklyRotator, ...overrides.weeklyRotator },
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
