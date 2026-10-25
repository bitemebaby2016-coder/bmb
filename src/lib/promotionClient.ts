// ============================================
// Bite Me Baby — Promotion / coupon client engine
//
// Client-side MIRROR of the server-authoritative promotion logic in migration
// 114 `create_order_with_items` (reused via 124 `create_order_with_items_i`):
//   • code lookup: upper(code) = upper(trim(input)) AND is_active
//   • date window: (start_date IS NULL OR start_date <= CURRENT_DATE) AND
//                  (end_date   IS NULL OR end_date   >= CURRENT_DATE)
//   • min order:   subtotal >= COALESCE(min_order_amount, 0)
//   • discount:    percentage → LEAST(subtotal * value / 100, subtotal)
//                  fixed_amount → LEAST(value, subtotal)
//
// This module is DISPLAY/PREVIEW ONLY — the server re-derives the authoritative
// discount at order creation (OrderResult.discount_amount). The client mirror
// exists so the customer sees the real rule (never a surprise silent ignore) and
// so the admin form can validate before writing to the `promotions` table.
// ============================================

import { supabase } from './supabase'
import { fetchPromotionScope, type PromotionRow } from './bmbAdminApi_promotions'

// ---------- code helpers ----------

/** Normalized promo code: trim + uppercase (server compares upper(code)). */
export function normalizePromoCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase()
}

/** YYYY-MM-DD in UTC — mirrors Postgres CURRENT_DATE (Supabase runs UTC). */
export function utcDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

// ---------- server-mirror discount math ----------

/**
 * Exact mirror of the 114 discount block (percentage/fixed, both capped at
 * subtotal). Unknown/missing discount_type → 0 (same as the SQL ELSE-less IFs).
 */
export function computeServerDiscount(promo: PromotionRow, subtotal: number): number {
  // Clamp at 0: the SQL LEAST() mirror is exact for valid rows; a negative
  // discount_value can only exist via direct DB writes (validatePromotionForm
  // blocks it at the admin form) and the display must never go negative.
  const value = Math.max(0, Number(promo.discount_value) || 0)
  const safeSubtotal = Math.max(0, subtotal)
  let discount = 0
  if (promo.discount_type === 'percentage') {
    discount = Math.min((safeSubtotal * value) / 100, safeSubtotal)
  } else if (promo.discount_type === 'fixed_amount') {
    discount = Math.min(value, safeSubtotal)
  } else {
    return 0
  }
  // [G&R 153] เพดานส่วนลดต่อออเดอร์ของแคมเปญ — mirror ของ promotion_apply_rules (4b)
  const cap = promo.max_discount_amount
  if (cap !== null && cap !== undefined && Number.isFinite(Number(cap))) {
    discount = Math.min(discount, Math.max(0, Number(cap)))
  }
  return discount
}

// ---------- coupon evaluation ----------

export type CouponRejectReason =
  | 'empty_code'
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'below_min'
  | 'load_failed'
  // ---- [G&R 153] กติกาแคมเปญใหม่จาก server (mirror ของ promotion_apply_rules) ----
  | 'disabled' // kill switch ปิด (promotion_policy.promotions_enabled = false)
  | 'budget_exhausted' // งบส่วนลดเดือนนี้เต็มแล้ว (server promotion_budget_ok)
  | 'out_of_scope' // แคมเปญจำกัดสินค้า แต่ไม่มีสินค้าในตะกร้าเข้าเกณฑ์
  | 'usage_exhausted' // ใช้ครบ usage_limit ของแคมเปญแล้ว

export type CouponEvaluation =
  | { ok: true; promo: PromotionRow; discountAmount: number }
  | { ok: false; reason: CouponRejectReason; promo?: PromotionRow; minOrderAmount?: number }

/**
 * บริบทที่ caller รู้จากที่อื่น (server/policy/cart) — ไม่ส่ง = ไม่บล็อกกฎนั้น
 * (sync path อย่าง cartStore.recalculate ไม่ยิง network — จุดที่บังคับจริงคือ
 *  fetchCouponEvaluation + revalidateCouponForSubmit ก่อนส่งออเดอร์ และ server อีกชั้น)
 */
export interface CouponContext {
  /** ยอดรวมของสินค้าในตะกร้าที่อยู่ใน scope ของแคมเปญ (เมื่อ applies_to = specific_products) */
  eligibleSubtotal?: number
  /** false = kill switch ปิด */
  promotionsEnabled?: boolean
  /** false = งบเดือนนี้ไม่พอสำหรับส่วนลดนี้ */
  budgetOk?: boolean
}

/**
 * Evaluate a coupon code against real `promotions` rows using the EXACT server
 * rule set (114 + 153). Rows without a code are display-only promos and can never
 * be applied as coupons (the server lookup is code-based).
 */
export function evaluateCoupon(
  rows: PromotionRow[],
  code: string | null | undefined,
  subtotal: number,
  today: Date = new Date(),
  ctx?: CouponContext,
): CouponEvaluation {
  const normalized = normalizePromoCode(code)
  if (!normalized) return { ok: false, reason: 'empty_code' }

  const promo = (rows || []).find((r) => normalizePromoCode(r.code) === normalized)
  if (!promo) return { ok: false, reason: 'not_found' }

  if (promo.is_active === false) return { ok: false, reason: 'inactive', promo }

  // DATE columns vs CURRENT_DATE (string compare on YYYY-MM-DD is exact).
  const todayKey = utcDateKey(today)
  if (promo.start_date && promo.start_date > todayKey) {
    return { ok: false, reason: 'not_started', promo }
  }
  if (promo.end_date && promo.end_date < todayKey) {
    return { ok: false, reason: 'expired', promo }
  }

  // ---- [G&R 153] (1) kill switch — เรียงตามลำดับเดียวกับ server ----
  if (ctx?.promotionsEnabled === false) return { ok: false, reason: 'disabled', promo }

  const minOrder = Number(promo.min_order_amount) || 0
  const safeSubtotal = Math.max(0, subtotal)
  if (safeSubtotal < minOrder) {
    return { ok: false, reason: 'below_min', promo, minOrderAmount: minOrder }
  }

  // ---- [G&R 153] (2) usage cap ----

  const usageLimit = promo.usage_limit === null || promo.usage_limit === undefined
    ? null
    : Number(promo.usage_limit)
  if (usageLimit !== null && Number(promo.usage_count ?? 0) >= usageLimit) {
    return { ok: false, reason: 'usage_exhausted', promo }
  }

  // ฐานส่วนลด: แคมเปญจำกัดสินค้า → ใช้ยอดเฉพาะสินค้าใน scope (ไม่ทราบ = 0 — ห้ามเดา)
  let base: number
  if (promo.applies_to === 'specific_products') {
    base = Math.max(0, ctx?.eligibleSubtotal ?? 0)
    if (base <= 0) return { ok: false, reason: 'out_of_scope', promo }
  } else {
    base = safeSubtotal
  }

  const discountAmount = computeServerDiscount(promo, base)
  if (discountAmount > 0 && ctx?.budgetOk === false) {
    return { ok: false, reason: 'budget_exhausted', promo }
  }

  return { ok: true, promo, discountAmount }
}

/** บรรทัดตะกร้าที่ใช้คำนวณฐานสินค้าเข้า scope (เมื่อแคมเปญจำกัดสินค้า) */
export interface CouponLine {
  productId: string
  subtotal: number
}

/**
 * Load real `promotions` rows and evaluate in one step (customer pages).
 * [G&R 153] ยิงตรวจกฎเพิ่มจาก server ทุกครั้ง: scope (promotion_products) ·
 * kill switch (business_settings.promotion_policy) · งบ (RPC promotion_budget_ok)
 * เพื่อให้ลูกค้าไม่เคยถูกคิดเต็มราคาโดยไม่รู้ตัวตอนกดสั่ง
 */
export async function fetchCouponEvaluation(
  code: string | null | undefined,
  subtotal: number,
  opts?: { lines?: CouponLine[] },
): Promise<CouponEvaluation> {
  const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
  if (error) return { ok: false, reason: 'load_failed' }
  const rows = (data || []) as PromotionRow[]

  // (a) scope ของแคมเปญที่จำกัดสินค้า (anon อ่านได้ — grants 153)
  const target = rows.find((r) => normalizePromoCode(r.code) === normalizePromoCode(code))
  let eligibleSubtotal: number | undefined
  if (target?.applies_to === 'specific_products') {
    const scope = await fetchPromotionScope([target.id])
    const ids = new Set(scope[target.id] ?? [])
    // ไม่มีบรรทัดตะกร้า = 0 (ห้ามเดาฐาน — server ใช้เกณฑ์เดียวกัน)
    eligibleSubtotal = (opts?.lines ?? [])
      .filter((l) => ids.has(l.productId))
      .reduce((sum, l) => sum + Math.max(0, l.subtotal), 0)
  }

  // (b) kill switch — อ่าน business_settings ตรง ๆ (public read · ไม่มี row/อ่านไม่ได้ = ไม่บล็อก
  //     เพราะ server ยังคุมซ้ำอยู่ดี)
  let promotionsEnabled: boolean | undefined
  try {
    const { data: policy } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'promotion_policy')
      .maybeSingle()
    if (policy) {
      const raw = typeof policy.value === 'string' ? JSON.parse(policy.value) : policy.value
      if (raw && typeof raw.promotions_enabled === 'boolean') promotionsEnabled = raw.promotions_enabled
    }
  } catch {
    promotionsEnabled = undefined
  }

  const first = evaluateCoupon(rows, code, subtotal, new Date(), {
    eligibleSubtotal,
    promotionsEnabled,
  })
  if (!first.ok) return first

  // (c) budget — ถาม server ด้วยส่วนลดที่คำนวณได้ (คืนแค่ boolean ไม่เปิดเผยตัวเลขยอดขาย)
  if (first.discountAmount > 0) {
    const { data: budgetOk, error: budgetErr } = await supabase.rpc('promotion_budget_ok', {
      p_discount: first.discountAmount,
      p_order_subtotal: subtotal,
    })
    if (!budgetErr && budgetOk === false) {
      return { ok: false, reason: 'budget_exhausted', promo: first.promo }
    }
  }
  return first
}

/** Plain-language Thai result copy — never claims a discount that did not apply. */
export function describeCouponResult(result: CouponEvaluation): string {
  if (result.ok) {
    return `ใช้โค้ด ${normalizePromoCode(result.promo.code)} สำเร็จ — คาดการณ์ส่วนลด ${result.discountAmount.toFixed(2)} บาท (ระบบยืนยันยอดจริงตอนสร้างออเดอร์)`
  }
  switch (result.reason) {
    case 'empty_code':
      return 'กรุณาใส่รหัสโปรโมชั่นก่อนกดใช้โค้ด'
    case 'not_found':
      return 'ไม่พบรหัสโปรโมชั่นนี้ — ตรวจตัวอักษร/ตัวเลขให้ถูกต้อง หรือดูโค้ดที่ใช้ได้ที่หน้าโปรโมชั่น'
    case 'inactive':
      return 'รหัสนี้ถูกปิดใช้งานชั่วคราว ยังใช้ส่วนลดไม่ได้'
    case 'not_started':
      return `รหัสนี้ยังไม่เริ่มรายการ${result.promo?.start_date ? ` (เริ่ม ${result.promo.start_date})` : ''}`
    case 'expired':
      return `รหัสนี้หมดอายุแล้ว${result.promo?.end_date ? ` (สิ้นสุด ${result.promo.end_date})` : ''}`
    case 'below_min':
      return `ยอดขั้นต่ำสำหรับรหัสนี้คือ ${(result.minOrderAmount ?? 0).toFixed(2)} บาท — เพิ่มสินค้าในตะกร้าให้ครบก่อนใช้โค้ด`
    case 'disabled':
      return 'ร้านปิดระบบโปรโมชั่นชั่วคราว — โค้ดนี้ยังใช้ไม่ได้ตอนนี้ (ยังไม่ได้หักส่วนลด)'
    case 'budget_exhausted':
      return 'โปรโมชั่นถึงเพดานงบส่วนลดรอบนี้แล้ว — ออเดอร์นี้จะไม่ได้ส่วนลดจากรหัสนี้ (ระบบไม่หักส่วนลดให้โดยไม่แจ้งล่วงหน้า)'
    case 'out_of_scope':
      return 'โค้ดนี้ใช้ได้เฉพาะสินค้าที่ร่วมรายการเท่านั้น — ยังไม่มีสินค้าที่เข้าเกณฑ์ในตะกร้า'
    case 'usage_exhausted':
      return 'โค้ดนี้ใช้ครบจำนวนสิทธิ์ที่ร้านกำหนดไว้แล้ว — ใช้โค้ดอื่นแทนได้เลย'
    case 'load_failed':
      return 'โหลดข้อมูลโปรโมชั่นไม่สำเร็จ — ลองใหม่อีกครั้ง (ยังไม่ได้หักส่วนลด)'
  }
}

// ---------- admin form validation ----------

export interface PromotionFormValues {
  name: string
  code: string
  description: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  min_order_amount: number
  start_date: string
  end_date: string
  is_active: boolean
  is_banner: boolean
  banner_image: string
  // ---- [G&R 153] คอลัมน์แคมเปญ (optional เพื่อให้ form เก่า/เทสต์เดิมเขียนได้) ----
  stackable?: boolean
  applies_to?: 'all_products' | 'specific_products'
  max_discount_amount?: number | null
  usage_limit?: number | null
  scope_product_ids?: string[]
}

export type PromotionFormValidation =
  | { ok: true; values: PromotionFormValues }
  | { ok: false; errors: string[] }

/**
 * Client-side guard for the admin promotions form. The DB enforces only the
 * column CHECKs — uniqueness of `code`, date order and sane discount bounds
 * are enforced here (duplicated codes would make server lookup non-deterministic
 * since 114 uses LIMIT 1).
 */
export function validatePromotionForm(
  form: PromotionFormValues,
  existing: PromotionRow[] = [],
  editingId?: string,
): PromotionFormValidation {
  const errors: string[] = []

  const name = form.name.trim()
  if (!name) errors.push('กรุณากรอกชื่อโปรโมชั่น')

  const code = normalizePromoCode(form.code)

  const discountValue = Number(form.discount_value)
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    errors.push('มูลค่าส่วนลดต้องมากกว่า 0')
  } else if (form.discount_type === 'percentage' && discountValue > 100) {
    errors.push('ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100')
  }

  const minOrder = Number(form.min_order_amount)
  if (!Number.isFinite(minOrder) || minOrder < 0) {
    errors.push('ยอดสั่งซื้อขั้นต่ำต้องไม่ติดลบ')
  }

  const start = form.start_date.trim()
  const end = form.end_date.trim()
  if (start && end && end < start) {
    errors.push('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น')
  }

  // ---- [G&R 153] คอลัมน์แคมเปญ ----
  if (form.max_discount_amount !== null && form.max_discount_amount !== undefined) {
    const cap = Number(form.max_discount_amount)
    if (!Number.isFinite(cap) || cap < 0) {
      errors.push('เพดานส่วนลดต่อออเดอร์ต้องเป็นตัวเลขไม่ติดลบ (เว้นว่าง = ไม่จำกัด)')
    }
  }
  if (form.usage_limit !== null && form.usage_limit !== undefined) {
    const limit = Number(form.usage_limit)
    if (!Number.isInteger(limit) || limit < 1) {
      errors.push('จำนวนสิทธิ์ต้องเป็นจำนวนเต็มอย่างน้อย 1 (เว้นว่าง = ไม่จำกัด)')
    }
  }
  if (form.applies_to === 'specific_products' && (form.scope_product_ids ?? []).length === 0) {
    errors.push('แคมเปญจำกัดสินค้าต้องเลือกสินค้าที่ร่วมรายการอย่างน้อย 1 รายการ (หรือเปลี่ยนเป็น "ทั้งออเดอร์")')
  }

  if (code) {
    const clash = existing.find((r) => r.id !== editingId && normalizePromoCode(r.code) === code)
    if (clash) errors.push(`โค้ด ${code} ถูกใช้แล้วในโปรโมชั่น "${clash.name}" — ใช้โค้ดอื่น (โค้ดต้องไม่ซ้ำเพื่อให้ระบบค้นหาได้แม่นยำ)`)
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    values: {
      name,
      code,
      description: form.description.trim(),
      discount_type: form.discount_type,
      discount_value: discountValue,
      min_order_amount: minOrder,
      start_date: start,
      end_date: end,
      is_active: form.is_active,
      is_banner: form.is_banner,
      banner_image: form.banner_image.trim(),
      stackable: form.stackable ?? false,
      applies_to: form.applies_to ?? 'all_products',
      max_discount_amount:
        form.max_discount_amount === null || form.max_discount_amount === undefined
          ? null
          : Number(form.max_discount_amount),
      usage_limit:
        form.usage_limit === null || form.usage_limit === undefined
          ? null
          : Number(form.usage_limit),
      scope_product_ids: form.scope_product_ids ?? [],
    },
  }
}