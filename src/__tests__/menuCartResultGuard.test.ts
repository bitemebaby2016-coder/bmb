// ============================================
// Bite Me Baby — P0 2026-10-14: MenuPage add-to-cart result contract
// ============================================
// Owner symptom: "กดปุ่มสั่ง/เพิ่มลงตะกร้าแล้วของไม่เข้าตะกร้า" — MenuPage เดิม
// เรียก addItem แล้ว toast "Added" + navigate ทุกกรณี ทั้งที่ AddToCartResult
// อาจเป็น 'blocked' / 'needs_confirmation' / 'context_blocked' (ไม่ได้เพิ่มอะไร)
// HomePage/TalkToBite เช็คแล้ว — MenuPage ต้องเช็คด้วย (RC-3/OD-4 contract)
// ============================================

import { describe, expect, it } from 'vitest'
import menuPageSrc from '../pages/MenuPage.tsx?raw'

const sameDayBlock = menuPageSrc.slice(
  menuPageSrc.indexOf('const handleSameDay'),
  menuPageSrc.indexOf('const handlePreOrder'),
)
const preOrderBlock = menuPageSrc.slice(menuPageSrc.indexOf('const handlePreOrder'))

describe('MenuPage.tsx — AddToCartResult ต้องถูกเช็คก่อน toast/navigate', () => {
  it('handleSameDay: เก็บผล addItem แล้ว gate ด้วย res !== added', () => {
    expect(sameDayBlock).toContain('const res = addItem(result.product, result.quantity, customizations)')
    expect(sameDayBlock).toContain("if (res !== 'added')")
    // gate ต้องมาก่อน toast "Added"
    expect(sameDayBlock.indexOf("if (res !== 'added')")).toBeLessThan(sameDayBlock.indexOf("'Added: '"))
  })

  it('handlePreOrder: เก็บผล addItem (PRE_ORDER) แล้ว gate ก่อน navigate ไป checkout', () => {
    expect(preOrderBlock).toContain("const res = addItem(result.product, result.quantity, customizations, 'PRE_ORDER')")
    expect(preOrderBlock).toContain("if (res !== 'added')")
    // ห้าม navigate ทั้งที่ไม่ได้เพิ่ม — gate ต้องมาก่อน navigate
    expect(preOrderBlock.indexOf("if (res !== 'added')")).toBeLessThan(preOrderBlock.indexOf("navigate('/checkout?mode=pre-order')"))
  })

  it('ทุก branch ที่ไม่ใช่ added ต้อง return (ไม่เดินหน้าต่อ)', () => {
    for (const block of [sameDayBlock, preOrderBlock]) {
      const gateAt = block.indexOf("if (res !== 'added')")
      expect(gateAt).toBeGreaterThan(-1)
      const gateSlice = block.slice(gateAt, block.indexOf('for (const rec of result.recommended)'))
      expect(gateSlice).toContain('return')
    }
  })
})