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
import type { PromotionRow } from './bmbAdminApi_promotions'

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
  if (promo.discount_type === 'percentage') {
    return Math.min((safeSubtotal * value) / 100, safeSubtotal)
  }
  if (promo.discount_type === 'fixed_amount') {
    return Math.min(value, safeSubtotal)
  }
  return 0
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

export type CouponEvaluation =
  | { ok: true; promo: PromotionRow; discountAmount: number }
  | { ok: false; reason: CouponRejectReason; promo?: PromotionRow; minOrderAmount?: number }

/**
 * Evaluate a coupon code against real `promotions` rows using the EXACT server
 * rule set (114). Rows without a code are display-only promos and can never be
 * applied as coupons (the server lookup is code-based).
 */
export function evaluateCoupon(
  rows: PromotionRow[],
  code: string | null | undefined,
  subtotal: number,
  today: Date = new Date(),
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

  const minOrder = Number(promo.min_order_amount) || 0
  if (Math.max(0, subtotal) < minOrder) {
    return { ok: false, reason: 'below_min', promo, minOrderAmount: minOrder }
  }

  return { ok: true, promo, discountAmount: computeServerDiscount(promo, subtotal) }
}

/** Load real `promotions` rows and evaluate in one step (customer pages). */
export async function fetchCouponEvaluation(
  code: string | null | undefined,
  subtotal: number,
): Promise<CouponEvaluation> {
  const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
  if (error) return { ok: false, reason: 'load_failed' }
  return evaluateCoupon((data || []) as PromotionRow[], code, subtotal)
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
    },
  }
}