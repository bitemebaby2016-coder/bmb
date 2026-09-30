// ============================================
// Bite Me Baby Admin API - Branch Overrides (CAT-04, migration 092)
// Per-branch product availability management
// ============================================

import { supabase } from './supabase'
import type { ProductBranchOverride } from '@/types'
import { useAdminTenantContextStore } from '@/lib/adminTenantContext'
import { useBrandContextStore } from '@/store/resolvedBrandStore'

/** Get all branch overrides for a given branch */
export async function getBranchOverrides(branchId: string): Promise<ProductBranchOverride[]> {
  const ctx = useAdminTenantContextStore.getState()
  const effectiveTenant = ctx.activeTenantId || (useBrandContextStore.getState().resolved?.tenant_id as string) || null
  
  let query = supabase.from('products_branch_overrides').select('*').order('branch_sort_order')
  if (effectiveTenant) query = query.eq('tenant_id', effectiveTenant)
  if (branchId) query = query.eq('branch_id', branchId)
  
  const { data, error } = await query
  if (error) { console.error('[getBranchOverrides] Error:', error); return [] }
  return (data || []) as ProductBranchOverride[]
}

/** Upsert a single product-branch override */
export async function upsertBranchOverride(override: Omit<ProductBranchOverride, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
  const { data, error } = await supabase.rpc('upsert_product_branch_override', {
    p_product_id: override.product_id,
    p_branch_id: override.branch_id,
    p_is_available_override: override.is_available_override,
    p_out_of_stock: override.out_of_stock,
    p_out_of_stock_reason: override.out_of_stock_reason,
    p_branch_sort_order: override.branch_sort_order,
  })
  if (error) { console.error('[upsertBranchOverride] RPC error:', error); return false }
  return true
}

/** Delete a branch override */
export async function deleteBranchOverride(productId: string, branchId: string): Promise<boolean> {
  const { error } = await supabase.rpc('delete_product_branch_override', {
    p_product_id: productId,
    p_branch_id: branchId,
  })
  if (error) { console.error('[deleteBranchOverride] RPC error:', error); return false }
  return true
}

/** Get resolved products for a specific branch (applying overrides) */
export async function getProductsForBranch(branchId: string): Promise<any[]> {
  // Use the RPC to resolve each product's effective availability at this branch
  const { data: products } = await supabase.from('products').select(`*,
    products_branch_overrides!inner(*)
  `).eq('branch_id', branchId).or('archived.is_false,is_available.is_true')
  
  if (!products) return []
  return products.map((p: any) => ({
    ...p.products,
    _branch_override: p.products_branch_overrides,
    _is_available_resolved: p.products_branch_overrides?.is_available_override ?? p.products.is_available,
    _out_of_stock_resolved: p.products_branch_overrides?.out_of_stock ?? !p.products.is_available,
  }))
}
