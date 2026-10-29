// ============================================
// BMB — cart discount guardrail (Owner 2026-10-29 · R21 Phase 2)
// ============================================
// กติกา: "ส่วนลดรวมจาก คูปอง + แต้ม + Referral ต้องไม่เกิน 15% ของยอดรวมสินค้า"
// หน้าที่ของไฟล์นี้ = ตรวจ + ให้ข้อความไทยพร้อมตัวเลข (UI เอาไปโชว์/บล็อกปุ่มสั่ง)
//
// ข้อจำกัดโดยเจตนา:
//   * pure function — ไม่ยิง network, ไม่ผูกกับ store (test ตรง ๆ ได้)
//   * DISPLAY/GUARD ฝั่งตะกร้า — ราคาที่ลูกค้าจ่ายจริง server ยัง re-price เอง
//     (create_order_with_items RPC) และยังไม่มี cap ฝั่ง DB → งานต่อ = P2 server cap
// ============================================

export interface DiscountParts {
  /** ส่วนลดจากคูปอง/โปรโมชั่น (cartStore.discount) */
  coupon?: number | null
  /** ส่วนลดจากการใช้แต้มสะสม */
  points?: number | null
  /** ส่วนลดจากรหัส referral */
  referral?: number | null
}

export type GuardrailCode = 'OK' | 'OVER_CAP' | 'ZERO_SUBTOTAL'

export interface GuardrailResult {
  itemsSubtotal: number
  /** % เพดาน (ค่าเริ่มต้น 15) */
  maxPct: number
  /** ยอดส่วนลดสูงสุดที่อนุญาต = maxPct% ของยอดรวมสินค้า */
  capAmount: number
  totalDiscount: number
  /** ส่วนลดรวมเป็น % ของยอดรวมสินค้า */
  discountPct: number
  allowed: boolean
  /** จำนวนเงินที่เกินเพดาน (0 ถ้าผ่าน) */
  excess: number
  code: GuardrailCode
  /** ข้อความไทยพร้อมตัวเลข สำหรับโชว์บน UI */
  message: string
}

/** เพดานส่วนลดรวม (% ของยอดรวมสินค้า) — ที่เดียวที่เปลี่ยนค่าได้ */
export const MAX_DISCOUNT_PCT = 15

function toAmount(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * ตรวจเพดานส่วนลดรวมของตะกร้า
 * @param itemsSubtotal ยอดรวมสินค้าก่อนส่วนลด/ค่าส่ง (subtotal ของตะกร้า)
 * @param discounts     ส่วนลดแต่ละแหล่ง (คูปอง/แต้ม/referral)
 * @param maxPct        เพดาน % (ค่าเริ่มต้น MAX_DISCOUNT_PCT = 15)
 */
export function evaluateDiscountGuardrail(
  itemsSubtotal: number,
  discounts: DiscountParts = {},
  maxPct: number = MAX_DISCOUNT_PCT,
): GuardrailResult {
  const subtotal = toAmount(itemsSubtotal)
  const pct = Number.isFinite(Number(maxPct)) && Number(maxPct) > 0 ? Number(maxPct) : MAX_DISCOUNT_PCT
  const coupon = toAmount(discounts.coupon)
  const points = toAmount(discounts.points)
  const referral = toAmount(discounts.referral)
  const totalDiscount = round2(coupon + points + referral)
  const capAmount = round2((subtotal * pct) / 100)
  const discountPct = subtotal > 0 ? round2((totalDiscount / subtotal) * 100) : 0

  if (subtotal <= 0) {
    return {
      itemsSubtotal: 0,
      maxPct: pct,
      capAmount: 0,
      totalDiscount,
      discountPct: 0,
      allowed: totalDiscount <= 0,
      excess: 0,
      code: 'ZERO_SUBTOTAL',
      message:
        totalDiscount > 0
          ? `มีส่วนลดรวม ${totalDiscount.toFixed(2)} บาท แต่ยังไม่มียอดรวมสินค้า — ลบคูปอง/แต้มก่อนสั่ง`
          : '',
    }
  }

  const excess = round2(totalDiscount - capAmount)
  if (excess > 0) {
    return {
      itemsSubtotal: subtotal,
      maxPct: pct,
      capAmount,
      totalDiscount,
      discountPct,
      allowed: false,
      excess,
      code: 'OVER_CAP',
      message:
        `ส่วนลดรวม ${totalDiscount.toFixed(2)} บาท (${discountPct.toFixed(1)}%) เกินเพดาน ${pct}% ` +
        `ของยอดสินค้า ${subtotal.toFixed(2)} บาท (สูงสุด ${capAmount.toFixed(2)} บาท) — ` +
        `ต้องลดลงอีก ${excess.toFixed(2)} บาท`,
    }
  }

  return {
    itemsSubtotal: subtotal,
    maxPct: pct,
    capAmount,
    totalDiscount,
    discountPct,
    allowed: true,
    excess: 0,
    code: 'OK',
    message: `ส่วนลดรวม ${totalDiscount.toFixed(2)} บาท (${discountPct.toFixed(1)}%) — อยู่ในเพดาน ${pct}% (สูงสุด ${capAmount.toFixed(2)} บาท)`,
  }
}

/** ข้อความสั้นสำหรับ toast/banner (คืน '' เมื่อผ่าน) */
export function describeGuardrail(result: GuardrailResult): string {
  return result.allowed ? '' : result.message
}
