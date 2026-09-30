// ============================================
// Bite Me Baby Admin Tenant API (TEN-06)
// Thin wrapper around PostgreSQL RPCs for tenant CRUD operations.
// All mutations go through SECURITY DEFINER functions — frontend never writes directly.
// Returns typed results matching the RPC contract.
// ============================================

import { supabase } from './supabase'
import type { TenantItem } from '@/lib/adminTenantContext'

/** List all tenants accessible to current user */
export async function listTenants(): Promise<TenantItem[]> {
  try {
    const { data, error } = await supabase.rpc('tenant_list_admin')
    if (error) throw error
    return (data || []) as TenantItem[]
  } catch (err: any) {
    console.error('[listTenants] Error:', err?.message || err)
    return []
  }
}

/** Get a single tenant detail by ID */
export async function getTenantById(tenantId: string): Promise<TenantItem | null> {
  try {
    const { data, error } = await supabase.rpc('tenant_get_admin', { p_tenant_id: tenantId })
    if (error) throw error
    return (data && data.length > 0) ? data[0] as TenantItem : null
  } catch (err: any) {
    console.error('[getTenantById] Error:', err?.message || err)
    // Return null for FORBIDDEN — don't leak auth errors to UI
    if (err?.message?.includes('FORBIDDEN') || err?.message?.includes('UNAUTHENTICATED')) return null
    return null
  }
}

/** Create a new tenant (platform admin only) */
export async function createTenant(name: string, slug: string): Promise<{ ok: boolean; tenant?: TenantItem; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('tenant_create_admin', { p_name: name, p_slug: slug })
    if (error) throw error
    return { ok: true, tenant: data?.[0] as TenantItem }
  } catch (err: any) {
    const msg = err?.message || 'Failed to create tenant'
    console.error('[createTenant] Error:', msg)
    return { ok: false, error: msg }
  }
}

/** Update tenant metadata (name/slug/status) */
export async function updateTenant(
  tenantId: string,
  options: { name?: string; slug?: string; status?: string }
): Promise<{ ok: boolean; tenant?: TenantItem; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('tenant_update_admin', {
      p_tenant_id: tenantId,
      p_name: options.name,
      p_slug: options.slug,
      p_status: options.status,
    })
    if (error) throw error
    return { ok: true, tenant: data?.[0] as TenantItem }
  } catch (err: any) {
    const msg = err?.message || 'Failed to update tenant'
    console.error('[updateTenant] Error:', msg)
    return { ok: false, error: msg }
  }
}

/** Set tenant status (quick toggle: active/inactive/suspended) */
export async function setTenantStatus(tenantId: string, status: 'active' | 'inactive' | 'suspended'): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('tenant_set_status', {
      p_tenant_id: tenantId,
      p_status: status,
    })
    if (error) throw error
    return { ok: true }
  } catch (err: any) {
    const msg = err?.message || 'Failed to update tenant status'
    console.error('[setTenantStatus] Error:', msg)
    return { ok: false, error: msg }
  }
}
