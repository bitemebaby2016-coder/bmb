// ============================================
// Bite Me Baby Admin API — Promotions (D5 gap)
// Phase D: DB-backed CRUD on the `promotions` table (admin RLS: is_admin()).
// ============================================

import { supabase } from './supabase'

export interface PromotionRow {
  id: string
  name: string
  description?: string | null
  code?: string | null
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  min_order_amount: number
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
  is_banner?: boolean
  banner_image?: string | null
  created_at?: string
  updated_at?: string
}

export async function getPromotionsAdmin(): Promise<PromotionRow[]> {
  const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[getPromotionsAdmin] Error:', error); return [] }
  return (data || []) as PromotionRow[]
}

/** Like getPromotionsAdmin but SURFACES failure (no silent empty-on-error) —
 *  public pages must distinguish "no promotions" from "load failed". */
export async function getPromotionsWithStatus(): Promise<{ rows: PromotionRow[]; ok: boolean }> {
  const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[getPromotionsWithStatus] Error:', error); return { rows: [], ok: false } }
  return { rows: (data || []) as PromotionRow[], ok: true }
}

export type PromoWriteResult = { ok: true; row: PromotionRow } | { ok: false; error: string }

export async function upsertPromotion(row: PromotionRow): Promise<PromoWriteResult> {
  const now = new Date().toISOString()
  const payload = { ...row, updated_at: now }

  if (row.id) {
    const { data, error } = await supabase.from('promotions').update(payload).eq('id', row.id).select().single()
    if (error) { console.error('[upsertPromotion] update error:', error); return { ok: false, error: error.message } }
    return { ok: true, row: data as PromotionRow }
  }

  const id = `promo-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const { data, error } = await supabase
    .from('promotions')
    .insert({ ...payload, id, created_at: now })
    .select()
    .single()
  if (error) { console.error('[upsertPromotion] insert error:', error); return { ok: false, error: error.message } }
  return { ok: true, row: data as PromotionRow }
}

export async function deletePromotion(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('promotions').delete().eq('id', id)
  if (error) { console.error('[deletePromotion] Error:', error); return { ok: false, error: error.message } }
  return { ok: true }
}

export async function togglePromotion(id: string, isActive: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('promotions').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[togglePromotion] Error:', error); return { ok: false, error: error.message } }
  return { ok: true }
}