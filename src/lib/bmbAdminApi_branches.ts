// ============================================
// Bite Me Baby Admin API — Branches (TEN-06 + TEN-07)
// Multi-branch management for tenant admins and platform admins
// ============================================

import { supabase } from './supabase'
import type { BranchItem } from './adminTenantContext'

export async function getBranchesForTenant(tenantId?: string): Promise<BranchItem[]> {
  const query = supabase.from('branches').select('*')
  
  if (tenantId) {
    query.eq('tenant_id', tenantId)
  } else {
    // Platform admin: see all active branches
    query.eq('status', 'active')
  }

  const { data, error } = await query.order('name')
  if (error) { console.error('[getBranchesForTenant] Error:', error); return [] }
  return (data || []) as BranchItem[]
}

export async function getBranchById(branchId: string): Promise<BranchItem | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', branchId)
    .maybeSingle()
  
  if (error) { console.error('[getBranchById] Error:', error); return null }
  return data as BranchItem | null
}

