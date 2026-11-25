// ============================================
// Bite Me Baby Admin API - Inventory
// ✅ v3.1: Using Supabase (replaces localStorage)
// Phase 1: Added prep yield, unit conversion, WAVG, supplier_id (Owner Decisions B1, B2, B3)
// ============================================

import { supabase } from './supabase'
import type { Ingredient, IngredientUnit } from '@/types'

export interface InventoryForm {
  id?: string
  name: string
  category: string
  unit: IngredientUnit
  current_stock: number
  min_stock: number
  max_stock: number
  unit_price: number
  supplier_name: string
  supplier_phone: string
  // Phase 1: New fields
  supplier_id?: string
  prep_yield_factor?: number
  prep_waste_pct?: number
  purchase_unit?: string
  use_unit?: string
  conversion_factor?: number
  package_size?: number
  gross_weight?: number
  net_weight?: number
  wavg_cost?: number
  last_purchase_price?: number
  last_approved_price?: number
}

// ============================================
// Inventory API — Supabase-backed
// ============================================

export async function updateInventory(id: string, data: Partial<InventoryForm>): Promise<Ingredient | null> {
  const { data: result, error } = await supabase.from('inventory')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) { console.error('[updateInventory] Error:', error); return null }
  return result as Ingredient
}

export async function deactivateInventory(id: string): Promise<boolean> {
  const { error } = await supabase.from('inventory')
    .update({ status: 'out_of_stock', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('[deactivateInventory] Error:', error); return false }
  return true
}

export async function getInventory(): Promise<Ingredient[]> {
  const { data, error } = await supabase.from('inventory').select('*').order('category')
  if (error) { console.error('[getInventory] Error:', error); return [] }
  return (data || []) as Ingredient[]
}

export async function getInventoryByName(name: string): Promise<Ingredient | null> {
  const { data, error } = await supabase.from('inventory').select('*').eq('name', name).single()
  if (error) { console.error('[getInventoryByName] Error:', error); return null }
  return data as Ingredient
}

export async function createInventory(data: InventoryForm): Promise<Ingredient | null> {
  const { data: result, error } = await supabase.from('inventory').insert({
    id: data.id || `ing-${Date.now()}`,
    name: data.name, category: data.category, unit: data.unit,
    current_stock: data.current_stock, min_stock: data.min_stock,
    max_stock: data.max_stock, unit_price: data.unit_price,
    supplier_name: data.supplier_name, supplier_phone: data.supplier_phone,
    // Phase 1: New fields
    supplier_id: data.supplier_id,
    prep_yield_factor: data.prep_yield_factor ?? 1.0,
    prep_waste_pct: data.prep_waste_pct ?? 0,
    purchase_unit: data.purchase_unit,
    use_unit: data.use_unit,
    conversion_factor: data.conversion_factor ?? 1.0,
    package_size: data.package_size,
    gross_weight: data.gross_weight,
    net_weight: data.net_weight,
    wavg_cost: data.wavg_cost,
    last_purchase_price: data.last_purchase_price,
    last_approved_price: data.last_approved_price,
  }).select().single()

  if (error) { console.error('[createInventory] Error:', error); return null }
  return result as Ingredient
}

export async function updateInventoryStock(id: string, quantity: number, reason: string): Promise<Ingredient | null> {
  const { data: existing, error: fetchError } = await supabase.from('inventory')
    .select('current_stock')
    .eq('id', id)
    .single()

  if (fetchError) { console.error('[updateInventoryStock] Fetch Error:', fetchError); return null }
  if (!existing) return null

  const newStock = Math.max(0, (existing as any).current_stock + quantity)

  const { data, error } = await supabase.from('inventory')
    .update({
      current_stock: newStock,
      last_restocked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) { console.error('[updateInventoryStock] Error:', error); return null }
  return data as Ingredient
}

export async function deleteInventory(id: string): Promise<boolean> {
  const { error } = await supabase.from('inventory').delete().eq('id', id)
  if (error) { console.error('[deleteInventory] Error:', error); return false }
  return true
}

export async function getLowStockAlerts(): Promise<Ingredient[]> {
  const { data, error } = await supabase.from('inventory').select('*').eq('status', 'low_stock').or('status.eq.out_of_stock')
  if (error) { console.error('[getLowStockAlerts] Error:', error); return [] }
  return (data || []) as Ingredient[]
}