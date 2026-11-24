// ============================================
// Bite Me Baby Admin API - Supplier Products Mapping
// Phase 1: Supplier ↔ Ingredient mapping with 3 price states
// ============================================

import { supabase } from './supabase'
import type { SupplierProduct, SupplierProductForm } from '@/types'

// ============================================
// Supplier Products API — Supabase-backed
// ============================================

export async function getSupplierProducts(supplierId?: string): Promise<SupplierProduct[]> {
  let query = supabase.from('supplier_products').select('*').eq('is_active', true).order('created_at', { ascending: false })
  if (supplierId) query = query.eq('supplier_id', supplierId)
  const { data, error } = await query
  if (error) { console.error('[getSupplierProducts] Error:', error); return [] }
  return (data || []) as SupplierProduct[]
}

export async function getSupplierProductById(id: string): Promise<SupplierProduct | null> {
  const { data, error } = await supabase.from('supplier_products').select('*').eq('id', id).single()
  if (error) { console.error('[getSupplierProductById] Error:', error); return null }
  return data as SupplierProduct
}

export async function getSupplierProductMapping(supplierId: string, ingredientId: string): Promise<SupplierProduct | null> {
  const { data, error } = await supabase
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('ingredient_id', ingredientId)
    .eq('is_active', true)
    .single()
  if (error) { 
    if (error.code !== 'PGRST116') console.error('[getSupplierProductMapping] Error:', error)
    return null 
  }
  return data as SupplierProduct
}

export async function createSupplierProduct(data: SupplierProductForm): Promise<SupplierProduct | null> {
  const { data: result, error } = await supabase.from('supplier_products').insert({
    id: data.id || `sp-${Date.now()}`,
    supplier_id: data.supplier_id,
    ingredient_id: data.ingredient_id,
    supplier_sku: data.supplier_sku,
    supplier_name: data.supplier_name,
    purchase_unit: data.purchase_unit,
    use_unit: data.use_unit,
    conversion_factor: data.conversion_factor ?? 1.0,
    last_committed_price: data.last_committed_price,
    last_realized_price: data.last_realized_price,
    last_approved_price: data.last_approved_price,
    min_order_qty: data.min_order_qty ?? 1,
    lead_time_days: data.lead_time_days ?? 7,
    is_preferred: data.is_preferred ?? false,
    is_active: data.is_active ?? true,
    tenant_id: data.tenant_id,
    branch_id: data.branch_id,
  }).select().single()

  if (error) { console.error('[createSupplierProduct] Error:', error); return null }
  return result as SupplierProduct
}

export async function updateSupplierProduct(id: string, data: Partial<SupplierProductForm>): Promise<SupplierProduct | null> {
  const { data: result, error } = await supabase.from('supplier_products')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) { console.error('[updateSupplierProduct] Error:', error); return null }
  return result as SupplierProduct
}

export async function updateSupplierProductPrice(
  id: string, 
  priceState: 'committed' | 'realized' | 'approved',
  price: number,
  timestamp: Date = new Date()
): Promise<SupplierProduct | null> {
  const fieldMap = {
    committed: { price: 'last_committed_price', at: 'last_committed_at' },
    realized: { price: 'last_realized_price', at: 'last_realized_at' },
    approved: { price: 'last_approved_price', at: 'last_approved_at' },
  }
  const fields = fieldMap[priceState]
  
  const { data: result, error } = await supabase.from('supplier_products')
    .update({
      [fields.price]: price,
      [fields.at]: timestamp.toISOString(),
      last_purchase_date: priceState === 'realized' ? timestamp.toISOString().split('T')[0] : undefined,
      updated_at: timestamp.toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) { console.error('[updateSupplierProductPrice] Error:', error); return null }
  return result as SupplierProduct
}

export async function deleteSupplierProduct(id: string): Promise<boolean> {
  // Soft delete
  const { error } = await supabase.from('supplier_products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('[deleteSupplierProduct] Error:', error); return false }
  return true
}

export async function getIngredientsForSupplier(supplierId: string): Promise<SupplierProduct[]> {
  const { data, error } = await supabase
    .from('supplier_products')
    .select('*, ingredient:inventory(*)')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) { console.error('[getIngredientsForSupplier] Error:', error); return [] }
  return (data || []) as any[]
}

export async function getSuppliersForIngredient(ingredientId: string): Promise<SupplierProduct[]> {
  const { data, error } = await supabase
    .from('supplier_products')
    .select('*, supplier:suppliers(*)')
    .eq('ingredient_id', ingredientId)
    .eq('is_active', true)
    .order('is_preferred', { ascending: false })
    .order('last_realized_price', { ascending: true })
  if (error) { console.error('[getSuppliersForIngredient] Error:', error); return [] }
  return (data || []) as any[]
}