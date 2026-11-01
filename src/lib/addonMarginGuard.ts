// ============================================
// Bite Me Baby — Add-on Margin Guard (R49 · Profit Weight ฝั่ง add-on)
// ============================================
// Owner: ผูกแอดออนกับหลักการคำนวณกำไร + กฎที่ Admin ตั้งจริง — ห้ามฮาร์ดโคด ห้ามสร้างซ้ำ
// ข้อมูลจริง (ของเดิม): products.addons JSON (+ promo_price/cost/margin_weight ที่ Admin ตั้งเพิ่ม)
// + business_settings.addon_margin_policy (m181) — pure ทั้งไฟล์ · ราคาคิดเงินจริง server re-derive เอง
// ============================================

import type { ProductAddon } from '@/types'

export interface AddonMarginPolicy {
  enabled: boolean
  /** เพดานส่วนลดรวม (% ยอดสินค้า) — แทนค่า hardcode เดิม 15 (แอดมินตั้ง) */
  maxDiscountPct: number
  /** กำไรขั้นต่ำของแอดออน (%) ที่ห้ามให้ส่วนลดกัดต่ำกว่า (0 = ปิด) */
  minAddonMarginPct: number
  /** true = แผง cross-sell แอดออน โชว์เฉพาะเมื่อมีเมนูหลักในตะกร้า */
  mainDishRequired: boolean
  /** เปิดแผง cross-sell แอดออน */
  crossSellEnabled: boolean
}

export const DEFAULT_ADDON_MARGIN_POLICY: AddonMarginPolicy = {
  enabled: true,
  maxDiscountPct: 15,
  minAddonMarginPct: 0,
  mainDishRequired: false,
  crossSellEnabled: true,
}

function num(v: unknown, d: number, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return d
  return Math.min(max, Math.max(min, n))
}

/** อ่าน business_settings.addon_margin_policy → policy ใช้ได้เสมอ (ค่าผิด/หาย = default) */
export function normalizeAddonMarginPolicy(raw: unknown): AddonMarginPolicy {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_ADDON_MARGIN_POLICY.enabled,
    maxDiscountPct: num(o.max_discount_pct, DEFAULT_ADDON_MARGIN_POLICY.maxDiscountPct, 0, 90),
    minAddonMarginPct: num(o.min_addon_margin_pct, DEFAULT_ADDON_MARGIN_POLICY.minAddonMarginPct, 0, 90),
    mainDishRequired: o.main_dish_required === true,
    crossSellEnabled: typeof o.cross_sell_enabled === 'boolean' ? o.cross_sell_enabled : true,
  }
}

/** ราคาแอดออนที่ลูกค้าเห็น/คิดจริง: promo_price > 0 = ใช้โปร มิฉะนั้นราคาปกติ */
export function effectiveAddonPrice(addon: Partial<ProductAddon> | Record<string, unknown> | null | undefined): number {
  if (!addon) return 0
  const promo = Number((addon as Record<string, unknown>).promo_price)
  const base = Number((addon as { price?: number }).price)
  if (Number.isFinite(promo) && promo > 0) return promo
  return Number.isFinite(base) ? base : 0
}

/** รายได้ขั้นต่ำต่อหน่วย (บาท) ที่ห้ามต่ำกว่าเมื่อมีต้นทุน + min margin % */
export function addonFloorPrice(cost: number, minMarginPct: number): number {
  const c = Number(cost)
  if (!Number.isFinite(c) || c <= 0) return 0
  const m = Math.min(90, Math.max(0, Number(minMarginPct) || 0))
  return m <= 0 ? c : c / (1 - m / 100)
}

/** คะแนน margin (Profit Weight): มีต้นทุน = กำไร% จริง · ไม่มี = margin_weight ที่แอดมินตั้ง */
export function addonMarginScore(addon: Partial<ProductAddon> | Record<string, unknown> | null | undefined): number {
  if (!addon) return 0
  const rec = addon as Record<string, unknown>
  const cost = Number(rec.cost)
  const eff = effectiveAddonPrice(addon)
  if (Number.isFinite(cost) && cost > 0 && eff > 0) return ((eff - cost) / eff) * 100
  const w = Number(rec.margin_weight)
  return Number.isFinite(w) ? w : 0
}

/** Cross-sell: เรียงแอดออนตามกำไรมาก→น้อย (tie = ราคา effective มากก่อน) */
export function sortAddonsByMargin<T extends Partial<ProductAddon> | Record<string, unknown>>(addons: T[]): T[] {
  return [...addons].sort((a, b) => {
    const d = addonMarginScore(b) - addonMarginScore(a)
    if (d !== 0) return d
    return effectiveAddonPrice(b) - effectiveAddonPrice(a)
  })
}
// MARKER_GUARD_2
export interface AddonDiscountGuardResult {
  allowed: boolean
  /** เพดาน THB สูงสุดที่ส่วนลดแตะแอดออนได้ */
  allowance: number
  /** ส่วนลดที่จัดสรรเข้าแอดออน (pro-rata) */
  allocated: number
  message: string
}

/**
 * Margin Protection Guard — "คูปองท้ายบิลห้ามกัดกำไรแอดออนจนติดลบ" (Admin ตั้งเพดาน)
 * @param addonSubtotal  ยอดรวมแอดออน (addonDisplay ของเดิม)
 * @param addonCostTotal ต้นทุนรวมแอดออน (แอดมินกรอก cost — 0 = ไม่รู้ต้นทุน → คุมด้วย % เท่านั้น)
 * @param orderSubtotal  ยอดสินค้ารวมก่อนส่วนลด
 * @param totalDiscount  ส่วนลดรวมทั้งบิล (คูปอง+แต้ม+referral)
 */
export function evaluateAddonDiscountGuard(
  addonSubtotal: number,
  addonCostTotal: number,
  orderSubtotal: number,
  totalDiscount: number,
  policy: AddonMarginPolicy,
): AddonDiscountGuardResult {
  const sub = Math.max(0, Number(addonSubtotal) || 0)
  const cost = Math.max(0, Number(addonCostTotal) || 0)
  const orderSub = Math.max(0, Number(orderSubtotal) || 0)
  const disc = Math.max(0, Number(totalDiscount) || 0)
  if (sub <= 0 || orderSub <= 0 || disc <= 0 || !policy.enabled) {
    return { allowed: true, allowance: sub, allocated: 0, message: '' }
  }
  const allocated = disc * (sub / orderSub)
  let allowance = sub * (policy.maxDiscountPct / 100)
  if (cost > 0) allowance = Math.min(allowance, Math.max(0, sub - addonFloorPrice(cost, policy.minAddonMarginPct)))
  allowance = Math.round(allowance * 100) / 100
  const allowed = allocated <= allowance + 0.01
  return {
    allowed,
    allowance,
    allocated: Math.round(allocated * 100) / 100,
    message: allowed
      ? ''
      : `ส่วนลดกระทบกำไรแอดออนเกินเพดาน ${policy.maxDiscountPct}% (เกิน ${(Math.round((allocated - allowance) * 100) / 100).toFixed(2)} บาท) — ลดส่วนลดหรือเพิ่มยอดเมนูหลัก`,
  }
}