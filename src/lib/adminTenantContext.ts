// ============================================
// Bite Me Baby — Admin Tenant & Branch Context (TEN-06 + TEN-07)
// Zustand store: single source of truth for {activeTenantId, activeBrandId, activeBranchId, isAdminScopePlatform}
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

export type BranchItem = {
  id: string
  name: string
  slug: string
  tenant_id: string
  status: 'active' | 'inactive' | 'suspended'
  kitchen_latitude?: number
  kitchen_longitude?: number
  created_at: string
  updated_at: string
}

export interface AdminTenantContextStore {
  /** The currently selected tenant ID (null = see all for platform admin) */
  activeTenantId: string | null

  /** The currently selected brand ID (null = use tenant default) */
  activeBrandId: string | null

  /** The currently selected branch ID (null = all branches within tenant scope) */
  activeBranchId: string | null

  /** Whether the current user is a platform admin (cross-tenant access) */
  isAdminScopePlatform: boolean

  /** List of tenants available to view/manage */
  availableTenants: TenantItem[]

  /** List of branches available within the active tenant scope */
  availableBranches: BranchItem[]

  /** Set the active tenant (called by TenantSelector) */
  setActiveTenant: (tenantId: string) => void

  /** Clear active tenant context (also clears branch) */
  clearActiveTenant: () => void

  /** Set available tenants list */
  setAvailableTenants: (tenants: TenantItem[]) => void

  /** Set platform admin scope flag */
  setPlatformAdminScope: (isPlatform: boolean) => void

  /** Set active brand ID */
  setActiveBrandId: (brandId: string | null) => void

  /** Set active branch ID (called by BranchSwitcher) */
  setActiveBranchId: (branchId: string | null) => void

  /** Set available branches list */
  setAvailableBranches: (branches: BranchItem[]) => void

  /** Get current tenant display info */
  getCurrentTenantName: () => string

  /** Get current tenant slug */
  getCurrentTenantSlug: () => string

  /** Get current branch display info */
  getCurrentBranchName: () => string

  /** Get current branch slug */
  getCurrentBranchSlug: () => string
}

export const useAdminTenantContextStore = create<AdminTenantContextStore>((set, get) => ({
  activeTenantId: null,
  activeBrandId: null,
  activeBranchId: null,
  isAdminScopePlatform: false,
  availableTenants: [],
  availableBranches: [],

  setActiveTenant: (tenantId) => set({ activeTenantId: tenantId }),

  clearActiveTenant: () => set({ activeTenantId: null, activeBrandId: null, activeBranchId: null }),

  setAvailableTenants: (tenants) => set({ availableTenants: tenants }),

  setPlatformAdminScope: (isPlatform) => set({ isAdminScopePlatform: isPlatform }),

  setActiveBrandId: (brandId) => set({ activeBrandId: brandId }),

  setActiveBranchId: (branchId) => set({ activeBranchId: branchId }),

  setAvailableBranches: (branches) => set({ availableBranches: branches }),

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

  getCurrentBranchName: () => {
    const store = get()
    if (!store.activeBranchId) return ''
    const branch = store.availableBranches.find(b => b.id === store.activeBranchId)
    return branch ? branch.name : store.activeBranchId
  },

  getCurrentBranchSlug: () => {
    const store = get()
    if (!store.activeBranchId) return ''
    const branch = store.availableBranches.find(b => b.id === store.activeBranchId)
    return branch ? branch.slug : store.activeBranchId
  },
}))

/** React hook returning the active tenant/branch context (reactive). */
export function useAdminTenantContext() {
  return useAdminTenantContextStore(s => ({
    activeTenantId: s.activeTenantId,
    activeBrandId: s.activeBrandId,
    activeBranchId: s.activeBranchId,
    isAdminScopePlatform: s.isAdminScopePlatform,
    availableTenants: s.availableTenants,
    availableBranches: s.availableBranches,
    getCurrentTenantName: s.getCurrentTenantName,
    getCurrentTenantSlug: s.getCurrentTenantSlug,
    getCurrentBranchName: s.getCurrentBranchName,
    getCurrentBranchSlug: s.getCurrentBranchSlug,
  }))
}

/** Separate hook focused on branch operations only */
export function useAdminBranchContext() {
  return useAdminTenantContextStore(s => ({
    activeBranchId: s.activeBranchId,
    availableBranches: s.availableBranches,
    setActiveBranchId: s.setActiveBranchId,
    setAvailableBranches: s.setAvailableBranches,
    getCurrentBranchName: s.getCurrentBranchName,
    getCurrentBranchSlug: s.getCurrentBranchSlug,
  }))
}
