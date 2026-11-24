// ============================================
// Bite Me Baby Admin API - Suppliers
// Phase 1: Supplier Master CRUD
// ============================================

import { supabase } from './supabase'
import type { Supplier, SupplierForm } from '@/types'

// ============================================
// Suppliers API — Supabase-backed
// ============================================

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) { console.error('[getSuppliers] Error:', error); return [] }
  return (data || []) as Supplier[]
}

export async function getAllSuppliers(includeInactive = false): Promise<Supplier[]> {
  let query = supabase.from('suppliers').select('*').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) { console.error('[getAllSuppliers] Error:', error); return [] }
  return (data || []) as Supplier[]
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single()
  if (error) { console.error('[getSupplierById] Error:', error); return null }
  return data as Supplier
}

export async function createSupplier(data: SupplierForm): Promise<Supplier | null> {
  const { data: result, error } = await supabase.from('suppliers').insert({
    id: data.id || `sup-${Date.now()}`,
    name: data.name,
    code: data.code,
    contact_name: data.contact_name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    payment_terms_days: data.payment_terms_days ?? 30,
    lead_time_days: data.lead_time_days ?? 7,
    is_active: data.is_active ?? true,
    tenant_id: data.tenant_id,
    branch_id: data.branch_id,
  }).select().single()

  if (error) { console.error('[createSupplier] Error:', error); return null }
  return result as Supplier
}

export async function updateSupplier(id: string, data: Partial<SupplierForm>): Promise<Supplier | null> {
  const { data: result, error } = await supabase.from('suppliers')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) { console.error('[updateSupplier] Error:', error); return null }
  return result as Supplier
}

export async function deleteSupplier(id: string): Promise<boolean> {
  // Soft delete - set is_active = false
  const { error } = await supabase.from('suppliers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('[deleteSupplier] Error:', error); return false }
  return true
}

export async function hardDeleteSupplier(id: string): Promise<boolean> {
  // Hard delete - only if no supplier_products reference it
  const { data: mappings } = await supabase
    .from('supplier_products')
    .select('id')
    .eq('supplier_id', id)
    .limit(1)
  
  if (mappings && mappings.length > 0) {
    console.error('[hardDeleteSupplier] Cannot delete: supplier has product mappings')
    return false
  }
  
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) { console.error('[hardDeleteSupplier] Error:', error); return false }
  return true
}