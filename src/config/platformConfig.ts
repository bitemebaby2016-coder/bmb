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
// Config shape (strictly typed — no free-form hard-coding)
// ---------------------------------------------------------------------------

export type OrderMode = 'SAME_DAY' | 'PRE_ORDER'

export interface DeliveryConfig {
  /** Radius (km) inside which Bite Drive (own fleet) serves — Tier 1. */
  biteDriveMaxDistanceKm: number
  /** Flat shipping fee (THB) charged for Tier 1 (Bite Drive). */
  biteDriveFlatFee: number
  /** Percentage markup injected on top of the external provider's real-time quote (Tier 2). */
  tier2MarkupPct: number
  /** Free-shipping threshold (cart subtotal THB) used by Bite AI upsell (Stage 2). */
  freeShippingThreshold: number
  /** Default order cutoff (hours before target delivery) used by the Truth Table engine. */
  cutoffHours: number
  /** Default daily quota (max orders per day) used by the Truth Table engine. */
  dailyQuota: number
  /** Debounce delay (ms) for the distance checker. */
  debounceMs: number
}

export interface GlassTheme {
  /** Glass surface — modern translucent + frosted border. */
  glassBg: string
  glassBlur: string
  glassBorder: string
  glassText: string
  /** 3D depth shadow (used instead of box-shadow on hero product/mascot). */
  depthShadow: string
}

export interface PlatformConfig {
  tenantId: string
  brandName: string
  currency: string
  delivery: DeliveryConfig
  theme: GlassTheme
  /** Pre-order items are grouped by these calendar attributes (weekly rotator). */
  weeklyRotator: {
    availableWeekAttr: 'available_week' | 'available_date'
    maxWeeks: number
  }
}

// ---------------------------------------------------------------------------
// Defaults (single-tenant fallback). Tenants override via `getPlatformConfig`.
// ---------------------------------------------------------------------------

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  tenantId: 'bmb-main',
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

/** Merge a partial tenant override on top of the defaults (never mutates). */
export function getPlatformConfig(tenantId?: string, overrides: Partial<PlatformConfig> = {}): PlatformConfig {
  const base = { ...DEFAULT_PLATFORM_CONFIG, tenantId: tenantId ?? DEFAULT_PLATFORM_CONFIG.tenantId }
  return {
    ...base,
    ...overrides,
    delivery: { ...base.delivery, ...overrides.delivery },
    theme: { ...base.theme, ...overrides.theme },
    weeklyRotator: { ...base.weeklyRotator, ...overrides.weeklyRotator },
  }
}

// ---------------------------------------------------------------------------
// Reactive store — components re-render when runtime config changes.
// ---------------------------------------------------------------------------

interface PlatformConfigStore {
  config: PlatformConfig
  setTenant: (tenantId?: string, overrides?: Partial<PlatformConfig>) => void
  setDeliveryOverrides: (overrides: Partial<DeliveryConfig>) => void
}

export const usePlatformConfigStore = create<PlatformConfigStore>((set) => ({
  config: DEFAULT_PLATFORM_CONFIG,
  setTenant: (tenantId?, overrides = {}) =>
    set({ config: getPlatformConfig(tenantId, overrides) }),
  setDeliveryOverrides: (overrides) =>
    set((state) => ({ config: { ...state.config, delivery: { ...state.config.delivery, ...overrides } } })),
}))

/** React hook returning the active tenant config (reactive). */
export function usePlatformConfig(): PlatformConfig {
  return usePlatformConfigStore((s) => s.config)
}
