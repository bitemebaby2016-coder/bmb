// ============================================
// Bite Me Baby Admin API - Inventory
// ✅ v3.1: Using Supabase (replaces localStorage)
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
}

// ============================================
// Inventory API — Supabase-backed
// ============================================

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
  }).select().single()

  if (error) { console.error('[createInventory] Error:', error); return null }
  return result as Ingredient
}

export async function updateInventoryStock(id: string, quantity: number, reason: string): Promise<Ingredient | null> {
  const { data, error } = await supabase.from('inventory')
    .update({
      current_stock: supabase.raw("GREATEST(0, current_stock + ?)", [quantity]),
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