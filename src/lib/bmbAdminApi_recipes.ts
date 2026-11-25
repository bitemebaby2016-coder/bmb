// ============================================
// Bite Me Baby Admin API — Recipes / BOM Management
// Phase 1: Batch yield, waste, cost fields (Owner Decision B3)
// ============================================

import { supabase } from './supabase'

export interface RecipeRow {
  id: string
  product_id: string
  ingredient_id: string
  quantity_per_unit: number
  ingredient_name?: string
  product_name?: string
  inventory_status?: string
  // Phase 1: Batch yield fields (Owner Decision B3)
  batch_yield_factor?: number
  batch_waste_pct?: number
  cost_per_unit?: number
  last_cost_calculated_at?: string
}

export interface RecipeForm {
  product_id: string
  ingredient_id: string
  quantity_per_unit: number
  batch_yield_factor?: number
  batch_waste_pct?: number
  cost_per_unit?: number
}

export async function listRecipes(): Promise<RecipeRow[]> {
  const { data, error } = await supabase.rpc('list_recipes_with_inventory')
  if (error) { console.error('[Recipes] list failed:', error); return [] }
  return (data as any)?.recipes ?? []
}

/** Create or update a recipe entry in the BOM */
export async function upsertRecipe(data: RecipeForm): Promise<boolean> {
  const idVal = 'rcp-' + data.product_id + '-' + data.ingredient_id
  // Check if exists first, then insert or update
  const { data: existing } = await supabase.from('recipes').select('id').match({ product_id: data.product_id, ingredient_id: data.ingredient_id }).single()
  const payload = {
    quantity_per_unit: data.quantity_per_unit,
    batch_yield_factor: data.batch_yield_factor ?? 1.0,
    batch_waste_pct: data.batch_waste_pct ?? 0,
    cost_per_unit: data.cost_per_unit,
    updated_at: new Date().toISOString(),
  }
  if (existing) {
    const { error } = await supabase.from('recipes').update(payload).match({ product_id: data.product_id, ingredient_id: data.ingredient_id })
    return !error
  } else {
    const { error } = await supabase.from('recipes').insert({ id: idVal, ...data, ...payload })
    return !error
  }
}

/** Update a recipe entry (for editing) */
export async function updateRecipe(product_id: string, ingredient_id: string, data: Partial<RecipeForm>): Promise<boolean> {
  const payload = {
    ...data,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('recipes').update(payload).match({ product_id, ingredient_id })
  return !error
}

/** Delete a recipe entry */
export async function deleteRecipe(product_id: string, ingredient_id: string): Promise<boolean> {
  const { error } = await supabase.from('recipes').delete().match({ product_id, ingredient_id })
  if (error) { console.error('[Recipes] delete failed:', error); return false }
  return true
}