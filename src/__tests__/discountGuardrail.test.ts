// ============================================
// BMB — cart discount guardrail tests (R21 Phase 2 · Owner 2026-10-29)
// กติกา: คูปอง + แต้ม + referral รวมกันต้องไม่เกิน 15% ของยอดรวมสินค้า
// ============================================
import { describe, it, expect } from 'vitest'
import {
  evaluateDiscountGuardrail,
  evaluateDiscountStacking,
  describeGuardrail,
  describeStacking,
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

describe('evaluateDiscountStacking — ห้ามซ้อน คูปอง x แต้ม (Owner Task 1)', () => {
  it('คูปองส่วนลดหลัก + แลกแต้มลดเงินสด ในบิลเดียวกัน = STACK_CONFLICT ห้ามผ่าน', () => {
    const r = evaluateDiscountStacking({ coupon: 50, points: 30 })
    expect(r.allowed).toBe(false)
    expect(r.code).toBe('STACK_CONFLICT')
    expect(r.coupon).toBe(50)
    expect(r.points).toBe(30)
    expect(r.message).toContain('ร่วมกับการแลกแต้ม')
    expect(r.message).toContain('ไม่ได้')
    expect(describeStacking(r)).toBe(r.message)
  })

  it('มีแค่คูปอง หรือ มีแค่แต้ม (หรือไม่มีเลย) = OK', () => {
    expect(evaluateDiscountStacking({ coupon: 100 }).allowed).toBe(true)
    expect(evaluateDiscountStacking({ points: 100 }).allowed).toBe(true)
    expect(evaluateDiscountStacking({}).allowed).toBe(true)
    expect(evaluateDiscountStacking().code).toBe('OK')
    expect(describeStacking(evaluateDiscountStacking({ coupon: 100 }))).toBe('')
  })

  it('Wallet Credit = payment-side: มากับคูปอง หรือ มากับแต้ม ก็ไม่ขัดกฎ', () => {
    const walletWithCoupon = evaluateDiscountStacking({ coupon: 50, walletCredit: 200 })
    expect(walletWithCoupon.allowed).toBe(true)
    expect(walletWithCoupon.walletCredit).toBe(200)

    const walletWithPoints = evaluateDiscountStacking({ points: 50, walletCredit: 200 })
    expect(walletWithPoints.allowed).toBe(true)
    expect(walletWithPoints.walletCredit).toBe(200)
  })

  it('Wallet ไม่ได้ช่วยให้ คูปอง+แต้ม ที่ผิดกฎผ่าน (กฎคูปอง✗แต้มยังห้ามแม้มี wallet)', () => {
    const r = evaluateDiscountStacking({ coupon: 50, points: 50, walletCredit: 100 })
    expect(r.allowed).toBe(false)
    expect(r.code).toBe('STACK_CONFLICT')
    expect(r.walletCredit).toBe(100)
  })

  it('Wallet Credit ไม่ถูกนับเป็นส่วนลด — ไม่แตะเพดาน 15% เดิม', () => {
    // ยอด 1000 · wallet 900 = ไม่ใช่ส่วนลด → cap guard เดิมมองไม่เห็น wallet อยู่แล้ว
    const cap = evaluateDiscountGuardrail(1000, { coupon: 150 })
    const stack = evaluateDiscountStacking({ coupon: 150, walletCredit: 900 })
    expect(cap.allowed).toBe(true) // เพดานเดิมคิดเฉพาะ coupon → ผ่าน
    expect(stack.allowed).toBe(true) // wallet ไม่ทำให้ขัดกฎ
    expect(cap.totalDiscount).toBe(150) // ยอดส่วนลดไม่รวม wallet
  })

  it('ค่าเพี้ยน (ลบ/NaN/Infinity) ถูก neutralize ก่อนตัดสิน', () => {
    const r = evaluateDiscountStacking({
      coupon: Number.NaN,
      points: -40,
      walletCredit: Number.POSITIVE_INFINITY,
    })
    expect(r.allowed).toBe(true)
    expect(r.coupon).toBe(0)
    expect(r.points).toBe(0)
    expect(r.walletCredit).toBe(0)
  })

  it('0 + 0 = ไม่ขัดกฎ (บิลไม่มีส่วนลดใด ๆ)', () => {
    const r = evaluateDiscountStacking({ coupon: 0, points: 0, walletCredit: 0 })
    expect(r.allowed).toBe(true)
    expect(r.code).toBe('OK')
  })
})
