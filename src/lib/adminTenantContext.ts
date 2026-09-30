// ============================================
// Bite Me Baby — Admin Tenant Context (TEN-06)
// Zustand store: single source of truth for {activeTenantId, activeBrandId, isAdminScopePlatform}
// All admin pages consume from this store instead of reading URL/localStorage directly.
// Security boundary is enforced by RLS / PostgreSQL RPCs — NOT by frontend state.
// ============================================

import { create } from 'zustand'

export type TenantItem = {
  id: string
  name: string
  slug: string
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
  updated_at: string
}

export interface AdminTenantContextStore {
  /** The currently selected tenant ID (null = see all for platform admin) */
  activeTenantId: string | null

  /** The currently selected brand ID (null = use tenant default) */
  activeBrandId: string | null

  /** Whether the current user is a platform admin (cross-tenant access) */
  isAdminScopePlatform: boolean

  /** List of tenants available to view/manage */
  availableTenants: TenantItem[]

  /** Set the active tenant (called by TenantSelector) */
  setActiveTenant: (tenantId: string) => void

  /** Clear active tenant context */
  clearActiveTenant: () => void

  /** Set available tenants list */
  setAvailableTenants: (tenants: TenantItem[]) => void

  /** Set platform admin scope flag */
  setPlatformAdminScope: (isPlatform: boolean) => void

  /** Set active brand ID */
  setActiveBrandId: (brandId: string | null) => void

  /** Get current tenant display info */
  getCurrentTenantName: () => string

  /** Get current tenant slug */
  getCurrentTenantSlug: () => string
}

export const useAdminTenantContextStore = create<AdminTenantContextStore>((set, get) => ({
  activeTenantId: null,
  activeBrandId: null,
  isAdminScopePlatform: false,
  availableTenants: [],

  setActiveTenant: (tenantId) => set({ activeTenantId: tenantId }),

  clearActiveTenant: () => set({ activeTenantId: null, activeBrandId: null }),

  setAvailableTenants: (tenants) => set({ availableTenants: tenants }),

  setPlatformAdminScope: (isPlatform) => set({ isAdminScopePlatform: isPlatform }),

  setActiveBrandId: (brandId) => set({ activeBrandId: brandId }),

  getCurrentTenantName: () => {
    const store = get()
    if (!store.activeTenantId) return ''
    const tenant = store.availableTenants.find(t => t.id === store.activeTenantId)
    return tenant ? tenant.name : store.activeTenantId
  },

  getCurrentTenantSlug: () => {
    const store = get()
    if (!store.activeTenantId) return ''
    const tenant = store.availableTenants.find(t => t.id === store.activeTenantId)
    return tenant ? tenant.slug : store.activeTenantId
  },
}))

/** React hook returning the active tenant context (reactive). */
export function useAdminTenantContext() {
  return useAdminTenantContextStore(s => ({
    activeTenantId: s.activeTenantId,
    activeBrandId: s.activeBrandId,
    isAdminScopePlatform: s.isAdminScopePlatform,
    availableTenants: s.availableTenants,
    getCurrentTenantName: s.getCurrentTenantName,
    getCurrentTenantSlug: s.getCurrentTenantSlug,
  }))
}
