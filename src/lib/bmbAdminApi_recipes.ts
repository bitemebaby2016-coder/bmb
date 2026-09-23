// ============================================
// Bite Me Baby Admin API — Recipes / BOM Management
// ============================================

import { supabase } from './supabase'

export interface RecipeRow {
  id: string
  product_id: string
  ingredient_id: string
  quantity_per_unit: number
  ingredient_name?: string
  inventory_status?: string
}

export async function listRecipes(): Promise<RecipeRow[]> {
  const { data, error } = await supabase.rpc('list_recipes_with_inventory')
  if (error) { console.error('[Recipes] list failed:', error); return [] }
  return (data as any)?.recipes ?? []
}

/** Create or update a recipe entry in the BOM */
export async function upsertRecipe(product_id: string, ingredient_id: string, quantity_per_unit: number): Promise<boolean> {
  const idVal = 'rcp-' + product_id + '-' + ingredient_id
  // Check if exists first, then insert or update
  const { data: existing } = await supabase.from('recipes').select('id').match({ product_id, ingredient_id }).single()
  if (existing) {
    const { error } = await supabase.from('recipes').update({ quantity_per_unit }).match({ product_id, ingredient_id })
    return !error
  } else {
    const { error } = await supabase.from('recipes').insert({ id: idVal, product_id, ingredient_id, quantity_per_unit })
    return !error
  }
}

/** Delete a recipe entry */
export async function deleteRecipe(product_id: string, ingredient_id: string): Promise<boolean> {
  const { error } = await supabase.from('recipes').delete().match({ product_id, ingredient_id })
  if (error) { console.error('[Recipes] delete failed:', error); return false }
  return true
}

