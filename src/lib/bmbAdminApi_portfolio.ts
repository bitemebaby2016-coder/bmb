// ============================================
// Bite Me Baby Admin API - Portfolio Items (CAT-04, migration 094)
// Admin-curated past works / promotional image albums
// ============================================

import { supabase } from './supabase'
import type { AdminPortfolioItem } from '@/types'
import { uploadMediaAsset, validateImageFile } from './bmbAdminApi_media'

/** Get all active portfolio items ordered by display_order */
export async function getPortfolioItems(): Promise<AdminPortfolioItem[]> {
  const { data, error } = await supabase
    .from('admin_portfolio_items')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) { console.error('[getPortfolioItems] Error:', error); return [] }
  return (data || []) as AdminPortfolioItem[]
}

/** Get all portfolio items (including inactive) for admin management */
export async function getAllPortfolioItems(): Promise<AdminPortfolioItem[]> {
  const { data, error } = await supabase
    .from('admin_portfolio_items')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) { console.error('[getAllPortfolioItems] Error:', error); return [] }
  return (data || []) as AdminPortfolioItem[]
}

/** Create a new portfolio item */
export async function createPortfolioItem(data: Omit<AdminPortfolioItem, 'id' | 'created_at' | 'updated_at'>): Promise<AdminPortfolioItem | null> {
  const { data: result, error } = await supabase
    .from('admin_portfolio_items')
    .insert({ ...data })
    .select()
    .single()
  if (error) { console.error('[createPortfolioItem] Error:', error); return null }
  return result as AdminPortfolioItem
}

/** Update a portfolio item */
export async function updatePortfolioItem(id: string, data: Partial<AdminPortfolioItem>): Promise<AdminPortfolioItem | null> {
  const { data: result, error } = await supabase
    .from('admin_portfolio_items')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('[updatePortfolioItem] Error:', error); return null }
  return result as AdminPortfolioItem
}

/** Toggle visibility of a portfolio item */
export async function togglePortfolioItem(id: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('admin_portfolio_items')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('[togglePortfolioItem] Error:', error); return false }
  return true
}

/** Delete a portfolio item */
export async function deletePortfolioItem(id: string): Promise<boolean> {
  const { error } = await supabase.from('admin_portfolio_items').delete().eq('id', id)
  if (error) { console.error('[deletePortfolioItem] Error:', error); return false }
  return true
}

/** Bulk reorder portfolio items by setting explicit display_order values */
export async function reorderByOrderIds(ids: string[]): Promise<boolean> {
  const { error } = await supabase.rpc('reorder_portfolio_items', { p_ids: ids })
  if (error) { console.error('[reorderByOrderIds] RPC error:', error); return false }
  return true
}
