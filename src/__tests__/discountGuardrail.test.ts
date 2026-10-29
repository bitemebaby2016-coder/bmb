// ============================================
// BMB — cart discount guardrail tests (R21 Phase 2 · Owner 2026-10-29)
// กติกา: คูปอง + แต้ม + referral รวมกันต้องไม่เกิน 15% ของยอดรวมสินค้า
// ============================================
import { describe, it, expect } from 'vitest'
import {
  evaluateDiscountGuardrail,
  describeGuardrail,
  MAX_DISCOUNT_PCT,
} from '@/lib/discountGuardrail'

describe('evaluateDiscountGuardrail — เพดาน 15%', () => {
  it('ค่าเริ่มต้น = 15% และ cap = 15% ของยอดสินค้า', () => {
    const r = evaluateDiscountGuardrail(1000, { coupon: 150 })
    expect(MAX_DISCOUNT_PCT).toBe(15)
    expect(r.capAmount).toBe(150)
    expect(r.allowed).toBe(true)
    expect(r.code).toBe('OK')
    expect(r.discountPct).toBe(15)
  })

  it('รวมสามแหล่งก่อนตัดสิน (คูปอง + แต้ม + referral)', () => {
    const pass = evaluateDiscountGuardrail(1000, { coupon: 80, points: 40, referral: 30 })
    expect(pass.totalDiscount).toBe(150)
    expect(pass.allowed).toBe(true)

    const fail = evaluateDiscountGuardrail(1000, { coupon: 80, points: 40, referral: 31 })
    expect(fail.totalDiscount).toBe(151)
    expect(fail.allowed).toBe(false)
    expect(fail.code).toBe('OVER_CAP')
    expect(fail.excess).toBe(1)
  })

  it('OVER_CAP ให้ข้อความไทยพร้อมตัวเลขทั้งยอดเกินและเพดาน', () => {
    const r = evaluateDiscountGuardrail(200, { coupon: 50 })
    expect(r.allowed).toBe(false)
    expect(r.capAmount).toBe(30)
    expect(r.excess).toBe(20)
    expect(r.message).toContain('เกินเพดาน 15%')
    expect(r.message).toContain('20.00')
    expect(describeGuardrail(r)).toBe(r.message)
  })

  it('ผ่านแล้ว describeGuardrail คืนค่าว่าง (ไม่ spam ผู้ใช้)', () => {
    const r = evaluateDiscountGuardrail(500, { coupon: 10 })
    expect(r.allowed).toBe(true)
    expect(describeGuardrail(r)).toBe('')
  })

  it('ค่าลบ/NaN/Infinity จากฝั่ง UI ถูก neutralize', () => {
    const r = evaluateDiscountGuardrail(1000, {
      coupon: -500,
      points: Number.NaN,
      referral: Number.POSITIVE_INFINITY,
    })
    expect(r.totalDiscount).toBe(0)
    expect(r.allowed).toBe(true)
  })

  it('ส่วนลดเกินยอดสินค้า (subtotal ต่ำกว่าส่วนลด) ยังโดนบล็อก', () => {
    const r = evaluateDiscountGuardrail(100, { coupon: 40 })
    expect(r.allowed).toBe(false)
    expect(r.excess).toBe(25) // 40 - 15
  })

  it('subtotal = 0 แต่มีส่วนลดค้าง → ZERO_SUBTOTAL ต้องไม่ผ่าน', () => {
    const withDiscount = evaluateDiscountGuardrail(0, { coupon: 10 })
    expect(withDiscount.code).toBe('ZERO_SUBTOTAL')
    expect(withDiscount.allowed).toBe(false)
    expect(withDiscount.message).toContain('ยังไม่มียอดรวมสินค้า')

    const empty = evaluateDiscountGuardrail(0, {})
    expect(empty.allowed).toBe(true)
    expect(empty.message).toBe('')
  })

  it('maxPct ปรับได้ (รองรับนโยบายรอบถัดไปโดยไม่แก้ที่อื่น)', () => {
    const r = evaluateDiscountGuardrail(1000, { coupon: 200 }, 20)
    expect(r.maxPct).toBe(20)
    expect(r.capAmount).toBe(200)
    expect(r.allowed).toBe(true)
  })

  it('ค่า maxPct เพี้ยน (0/ลบ/ไม่ใช่ตัวเลข) ใช้ 15% ตามกติกาเดิม', () => {
    expect(evaluateDiscountGuardrail(1000, { coupon: 151 }, 0).maxPct).toBe(15)
    expect(evaluateDiscountGuardrail(1000, { coupon: 151 }, -5 as number).maxPct).toBe(15)
  })
})
