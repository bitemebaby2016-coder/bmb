// ============================================
// Bite Me Baby — R5 "แยกฟีเจอร์พรีออเดอร์" (Owner 2026-10-23, migration 141)
//   1) PRE_ORDER รับสินค้าทุกตัว (สินค้าทั่วไปส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้)
//   2) เมนูรอบพิเศษ (menu_schedule 7 วัน/14 เมนู) ผูก "วันจัดส่ง" ตามปฏิทินแอดมิน
//      (ป้ายมุมเมนู) — resolveMenuBoundDate ล็อกวันให้ checkout, ลูกค้าเลือกแค่รอบ
//   3) วันเมนูที่ผ่านรอบจัดส่ง = archive (ไม่โชว์ลูกค้า, วนใช้รอบถัดไปได้)
// ============================================

import { describe, it, expect } from 'vitest'
import { pickNextScheduleDates, resolveMenuBoundDate, isMenuDateArchived } from '@/lib/productSchedule'
import { mirrorPreOrderScheduleGate, checkModeEligibility } from '@/lib/bmbMenuSchedule'

const TODAY = '2026-10-23'
const TOMORROW = '2026-10-24'

describe('R5 · resolveMenuBoundDate — วันจัดส่งถูกกำหนดโดยปฏิทินแอดมิน', () => {
  it('ไม่มีสินค้าผูกวัน → date=null (R5c: ไม่มีพรีออเดอร์วันอิสระ — ต้องมีเมนูปฏิทินในตะกร้า)', () => {
    expect(resolveMenuBoundDate([{ product_id: 'a' }, { product_id: 'b' }], {})).toEqual({ date: null, conflict: [] })
  })

  it('สินค้าผูกวันเดียวกัน → date นั้น (ลูกค้าเลือกแค่รอบ)', () => {
    const map = { a: TOMORROW, b: TOMORROW }
    expect(resolveMenuBoundDate([{ product_id: 'a' }, { product_id: 'b' }, { product_id: 'free' }], map)).toEqual({ date: TOMORROW, conflict: [] })
  })

  it('ผูกหลายวันต่างกัน → conflict (แยกสั่ง — ไม่เดา/ไม่ merge)', () => {
    const map = { a: TOMORROW, b: '2026-10-25' }
    const res = resolveMenuBoundDate([{ product_id: 'a' }, { product_id: 'b' }], map)
    expect(res.date).toBeNull()
    expect(res.conflict).toEqual([TOMORROW, '2026-10-25'].sort())
  })
})

describe('R5 · archive วันเมนูที่ผ่านรอบจัดส่ง', () => {
  it('isMenuDateArchived: วันผ่านไปแล้ว = archived · วันนี้/อนาคต = ยังไม่ archived', () => {
    expect(isMenuDateArchived('2026-10-17', TODAY)).toBe(true)
    expect(isMenuDateArchived(TODAY, TODAY)).toBe(false)
    expect(isMenuDateArchived(TOMORROW, TODAY)).toBe(false)
  })

  it('pickNextScheduleDates ไม่โชว์วันที่ผ่านรอบจัดส่ง (ไม่ต้องโชว์วันที่เลยไป)', () => {
    const rows = [
      { product_id: 'a', scheduled_date: '2026-10-17', is_published: true },
      { product_id: 'a', scheduled_date: TOMORROW, is_published: true },
      { product_id: 'b', scheduled_date: '2026-10-17', is_published: true },
    ]
    const map = pickNextScheduleDates(rows, TODAY)
    expect(map).toEqual({ a: TOMORROW }) // b เหลือเฉพาะแถว archived → ไม่โชว์ป้าย
  })
})

describe('R5 · mirrorPreOrderScheduleGate (mirror ของ enforce_menu_gate 141)', () => {
  const rows = [
    { id: 'ms-1', scheduled_date: TOMORROW, product_id: 'menu-1', delivery_round_key: null, is_published: true, note: '' },
  ]

  it('สินค้าทั่วไป + เมนูรอบพิเศษ ส่งร่วมรอบเดียวกันในวันเมนู → allowed', () => {
    const res = mirrorPreOrderScheduleGate(
      [{ product_id: 'menu-1', quantity: 1 }, { product_id: 'free-1', quantity: 1 }],
      TOMORROW, rows,
    )
    expect(res.allowed).toBe(true)
  })

  it('เมนูผูกวันอื่น (boundDates จากป้ายมุมเมนู) → rejected ERR_PRODUCT_NOT_ON_MENU', () => {
    const res = mirrorPreOrderScheduleGate(
      [{ product_id: 'menu-1', quantity: 1 }],
      '2026-10-25', rows, null, null, { 'menu-1': TOMORROW },
    )
    expect(res.allowed).toBe(false)
    expect(res.rejected?.[0]).toEqual({ product_id: 'menu-1', code: 'ERR_PRODUCT_NOT_ON_MENU' })
  })

  it('เมนูผูก round key → ผ่านเฉพาะรอบที่เมนูกำหนด', () => {
    const boundRows = [{ ...rows[0], delivery_round_key: 'midday' }]
    expect(mirrorPreOrderScheduleGate([{ product_id: 'menu-1', quantity: 1 }], TOMORROW, boundRows, 'midday').allowed).toBe(true)
    const wrong = mirrorPreOrderScheduleGate([{ product_id: 'menu-1', quantity: 1 }], TOMORROW, boundRows, 'evening')
    expect(wrong.allowed).toBe(false)
    expect(wrong.rejected?.[0].code).toBe('ERR_PRODUCT_NOT_ON_MENU')
  })
})

describe('R5 · checkModeEligibility — PRE_ORDER รับสินค้าทุกตัว', () => {
  it('PRE_ORDER ผ่านทุกสินค้าที่ยังขายอยู่ (รวมสินค้าที่ไม่ใช่พรีออเดอร์)', () => {
    const items = [
      { product_id: 'a', name: 'A', is_available: true, preorder_ok: true, same_day_ok: true },
      { product_id: 'b', name: 'B', is_available: true, preorder_ok: false, same_day_ok: true },
      { product_id: 'c', name: 'C', is_available: true, preorder_ok: false, same_day_ok: false },
    ]
    expect(checkModeEligibility(items, 'PRE_ORDER').ok).toBe(true)
  })

  it('SAME_DAY ยังเช็ก same_day_ok และ is_available ทั้งสองโหมด', () => {
    expect(checkModeEligibility([{ product_id: 'c', name: 'C', is_available: true, preorder_ok: false, same_day_ok: false }], 'SAME_DAY').ok).toBe(false)
    expect(checkModeEligibility([{ product_id: 'x', name: 'X', is_available: false, preorder_ok: true, same_day_ok: true }], 'PRE_ORDER').ok).toBe(false)
  })
})