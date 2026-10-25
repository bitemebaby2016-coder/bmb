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
  // ---- G&R stage 1 (migration 153) — คอลัมน์แคมเปญ ----
  /** ซ้อนกับสิทธิ์อื่นได้ (false = เลือกข้อเสนอเดียว) — การ combine กับแต้มถูกบังคับตอน Loyalty stage */
  stackable?: boolean
  /** ขอบเขตสินค้าที่ร่วมรายการ ('all_products' = ทั้งออเดอร์) */
  applies_to?: 'all_products' | 'specific_products'
  /** เพดานส่วนลดต่อออเดอร์ (บาท · null = ไม่จำกัด) */
  max_discount_amount?: number | null
  /** จำนวนสิทธิ์สูงสุด (null = ไม่จำกัด) */
  usage_limit?: number | null
  /** ใช้ไปแล้ว (นับเฉพาะออเดอร์ที่ส่วนลด > 0 — server เท่านั้นที่เขียน) */
  usage_count?: number
  /** scope ids — client-side derived จาก promotion_products (ไม่ใช่คอลัมน์ DB) */
  scope_product_ids?: string[] | null
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

/** ฟิลด์ที่ client เขียนได้ — scope_product_ids (derived) และ usage_count (server-only) ถูกกันออกจาก payload */
function toWritePayload(row: PromotionRow, now: string): Record<string, unknown> {
  const { scope_product_ids: _scope, usage_count: _usage, ...rest } = row
  void _scope
  void _usage
  return { ...rest, updated_at: now }
}

/** อ่าน scope ของโปรโมชั่น (promotion_products) — คืน map promotion_id → product ids */
export async function fetchPromotionScope(
  promotionIds: string[],
): Promise<Record<string, string[]>> {
  if (promotionIds.length === 0) return {}
  const { data, error } = await supabase
    .from('promotion_products')
    .select('promotion_id, product_id')
    .in('promotion_id', promotionIds)
  if (error) {
    console.error('[fetchPromotionScope] Error:', error)
    return {}
  }
  const out: Record<string, string[]> = {}
  for (const r of (data || []) as Array<{ promotion_id: string; product_id: string }>) {
    ;(out[r.promotion_id] ||= []).push(r.product_id)
  }
  return out
}

/** ผูกแถว promotion ที่โหลดมาให้มี scope_product_ids (เมื่อ applies_to = specific_products) */
export async function attachPromotionScope(rows: PromotionRow[]): Promise<PromotionRow[]> {
  const ids = rows.filter((r) => r.applies_to === 'specific_products').map((r) => r.id)
  if (ids.length === 0) return rows
  const scope = await fetchPromotionScope(ids)
  return rows.map((r) =>
    r.applies_to === 'specific_products' ? { ...r, scope_product_ids: scope[r.id] ?? [] } : r,
  )
}

/** แทนที่ scope ของโปรโมชั่นหนึ่ง (delete-then-insert — แอดมินตั้งเองทั้งชุด) */
export async function setPromotionScope(
  promotionId: string,
  productIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const { error: delErr } = await supabase
    .from('promotion_products')
    .delete()
    .eq('promotion_id', promotionId)
  if (delErr) return { ok: false, error: delErr.message }
  const unique = [...new Set(productIds.filter((p) => p && p.trim() !== ''))]
  if (unique.length === 0) return { ok: true }
  const { error: insErr } = await supabase.from('promotion_products').insert(
    unique.map((product_id) => ({ promotion_id: promotionId, product_id })),
  )
  if (insErr) return { ok: false, error: insErr.message }
  return { ok: true }
}

export async function upsertPromotion(row: PromotionRow): Promise<PromoWriteResult> {
  const now = new Date().toISOString()
  const payload = toWritePayload(row, now)

  let saved: PromotionRow
  if (row.id) {
    const { data, error } = await supabase.from('promotions').update(payload).eq('id', row.id).select().single()
    if (error) { console.error('[upsertPromotion] update error:', error); return { ok: false, error: error.message } }
    saved = data as PromotionRow
  } else {
    const id = `promo-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { data, error } = await supabase
      .from('promotions')
      .insert({ ...payload, id, created_at: now })
      .select()
      .single()
    if (error) { console.error('[upsertPromotion] insert error:', error); return { ok: false, error: error.message } }
    saved = data as PromotionRow
  }

  // scope: แคมเปญจำกัดสินค้า → แทนที่ชุด · แคมเปญทั้งออเดอร์ → ล้างทิ้ง (กัน scope เก่าค้าง)
  if (saved.applies_to === 'specific_products') {
    const scopeRes = await setPromotionScope(saved.id, row.scope_product_ids ?? [])
    if (!scopeRes.ok) return { ok: false, error: `บันทึก scope สินค้าไม่สำเร็จ: ${scopeRes.error}` }
    saved = { ...saved, scope_product_ids: row.scope_product_ids ?? [] }
  } else {
    await setPromotionScope(saved.id, [])
    saved = { ...saved, scope_product_ids: [] }
  }
  return { ok: true, row: saved }
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