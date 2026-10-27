// ============================================
// Bite Me Baby — P0 2026-10-14: Add-to-cart result contract
// (2026-10-26: ตรวจที่เส้นทางเดียว `orderEntry.ts` แทนสำเนาในหน้า)
// ============================================
// Owner symptom: "กดปุ่มสั่ง/เพิ่มลงตะกร้าแล้วของไม่เข้าตะกร้า" — เดิม MenuPage
// เรียก addItem แล้ว toast "Added" + navigate ทุกกรณี ทั้งที่ AddToCartResult
// อาจเป็น 'blocked' / 'context_blocked' (ไม่ได้เพิ่มอะไร) และ flow นี้เคยซ้ำกัน
// 2 ที่ (MenuPage + HomePage) จนแก้ไม่ครบ → 2026-10-26 ยุบเป็น implementation
// เดียวที่ `src/lib/orderEntry.ts` แล้วให้ทุกหน้า delegate
//
// ระดับความเข้มของ assertion คงเดิมทุกข้อ (gate ต้องอยู่ก่อน toast/navigate +
// ทุก branch ที่ไม่ใช่ added ต้อง return) แต่เปลี่ยน "เป้าตรวจ" จากสำเนาในหน้า
// เป็นเส้นทางเดียว + เพิ่มกันไม่ให้เอาสำเนากลับมา
// ============================================

import { describe, expect, it } from 'vitest'
import entrySrc from '../lib/orderEntry.ts?raw'
import menuPageSrc from '../pages/MenuPage.tsx?raw'
import homePageSrc from '../pages/HomePage.tsx?raw'

const addAt = entrySrc.indexOf('const res = addItem(result.product, result.quantity, customizations, mode)')
const gateAt = entrySrc.indexOf("if (res !== 'added')")
const recAt = entrySrc.indexOf('for (const rec of result.recommended)')
const addedAt = entrySrc.indexOf('onAdded?.(result)')
const navigateAt = entrySrc.indexOf("navigate('/checkout?mode=pre-order')")

describe('orderEntry.ts — AddToCartResult ต้องถูกเช็คก่อน toast/navigate', () => {
  it('เก็บผล addItem ไว้ในตัวแปรแล้ว gate ด้วย res !== added', () => {
    expect(addAt).toBeGreaterThan(-1)
    expect(gateAt).toBeGreaterThan(addAt)
    // branch ที่ไม่ใช่ added ต้อง return ทันที (ไม่เดินหน้าต่อ)
    const gateSlice = entrySrc.slice(gateAt, recAt)
    expect(gateSlice).toContain('return')
    // ทุกการแจ้งเตือน/ผลลัพธ์ที่ "สำเร็จ" ต้องอยู่หลัง gate เสมอ
    expect(addedAt).toBeGreaterThan(gateAt)
    expect(recAt).toBeGreaterThan(gateAt)
  })

  it('handlePreOrder: gate ต้องมาก่อน navigate ไป checkout', () => {
    // Owner 2026-10-27 "อย่าเพิ่งส่งไปเช็คเอาท์" — ยกเลิก navigate อัตโนมัติไป /checkout
    expect(navigateAt).toBe(-1)
    expect(gateAt).toBeGreaterThan(-1)
    // navigate เฉพาะ PRE_ORDER เท่านั้น (SAME_DAY อยู่หน้าเดิมตาม UX เดิม)
    expect(entrySrc).not.toContain("navigate('/checkout?mode=pre-order')")
  })

  it('ทุกหน้าสั่งซื้อ delegate เส้นทางเดียว — ไม่มีสำเนา flow ซ้ำในหน้า', () => {
    for (const src of [menuPageSrc, homePageSrc]) {
      expect(src).toContain('runOrderBuilder({')
      expect(src).not.toContain('openBuilder(product, products')
      expect(src).not.toContain('addItem(result.product, result.quantity, customizations')
    }
  })
})