

// ============================================
// Bite Me Baby — Resolved Brand Store (TEN-05)
// Zustand store: single source of truth for {tenant_id, brand_id, brand}
// All components consume from this store instead of reading URL directly.
// ============================================

import { create } from 'zustand'
import type { ResolvedBrandResult } from '@/lib/brandResolver'

export interface BrandContextStore {
  /** The resolved brand result (canonical source of truth) */
  resolved: ResolvedBrandResult | null

  /** Set the resolved brand after resolution logic runs */
  setResolved: (result: ResolvedBrandResult) => void

  /** Clear resolved brand (logout, tenant switch) */
  clearResolved: () => void

  /** Convenience accessor: tenant_id */
  getTenantId: () => string | null

  /** Convenience accessor: brand_id */
  getBrandId: () => string | null

  /** Convenience accessor: slug */
  getSlug: () => string | null

  /** Convenience accessor: theme_tokens */
  getThemeTokens: () => Record<string, any> | null
}

/** Resolve theme tokens from brand → CSS variables */
function extractCssVars(tokens: Record<string, any>): Record<string, string> {
  if (!tokens || typeof tokens !== 'object') return {}
  const obj = tokens as Record<string, string>
  return {
    '--bmb-primary': obj.primary_color || '#F97316',
    '--bmb-secondary': obj.secondary_color || '#FBBF24',
    '--bmb-accent': obj.accent_color || '#92400E',
    '--bmb-bg-base': obj.bg_base || '#FFF7ED',
    '--bmb-surface': obj.surface_color || '#FFFFFF',
    '--bmb-text': obj.text_base || '#1C1917',
    '--bmb-font-display': obj.font_display || 'Nunito',
    '--bmb-font-body': obj.font_body || 'Quicksand',
  }
}

export const useBrandContextStore = create<BrandContextStore>((set, get) => ({
  resolved: null,

  setResolved: (result) => set({ resolved: result }),

  clearResolved: () => set({ resolved: null }),

  getTenantId: () => get().resolved?.tenant_id ?? null,

  getBrandId: () => get().resolved?.brand_id ?? null,

  getSlug: () => get().resolved?.slug ?? null,

  getThemeTokens: () => {
    const r = get().resolved
    if (!r?.brand?.theme_tokens) return null
    return r.brand.theme_tokens
  },

}))

/** React hook for theme tokens specifically */
export function useThemeTokens(): Record<string, string> {
  const tokens = useBrandContextStore(s => s.resolved?.brand?.theme_tokens)
  if (!tokens) return {
    '--bmb-primary': '#F97316',
    '--bmb-secondary': '#FBBF24',
    '--bmb-accent': '#92400E',
    '--bmb-bg-base': '#FFF7ED',
    '--bmb-surface': '#FFFFFF',
    '--bmb-text': '#1C1917',
    '--bmb-font-display': 'Nunito',
    '--bmb-font-body': 'Quicksand',
  }
  return extractCssVars(tokens)
}
