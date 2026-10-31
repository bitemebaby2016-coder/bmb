// ============================================
// Bite Me Baby — R35 contracts (Owner 2026-10-31)
// 1) สติกเกอร์: ค่า Menu/Notice หลัง ':' บรรทัดเดียวกัน (≤2/≤2) · ช่วง Tel→QR แคบ
// 2) /menu?tab=pre-order: ชิปรอบ (เที่ยง/เช้า ซ้ำ ๆ) ถูกถอดออกจาก banner ("ในวงเล็บไม่ต้องแสดง")
// 3) showcase พรีออเดอร์: วันใกล้วันปัจจุบันขึ้นก่อน (หน้าแรก + /menu)
// ============================================
import { describe, it, expect } from 'vitest'
import stickerSrc from '../lib/stickerPng.ts?raw'
import menuSrc from '../pages/MenuPage.tsx?raw'
import homeSrc from '../pages/HomePage.tsx?raw'
import { stickerDrawList, STICKER_PX_H, type StickerOp } from '@/lib/stickerPng'
import type { PrintOrderData } from '@/lib/printService'

const order: PrintOrderData = {
  order_number: 'BMB-20261031-0001',
  created_at: '2026-10-31T09:00:00+07:00',
  customer_name: 'ทดสอบ ร35',
  customer_phone: '0800000000',
  items: [{ product_name: 'ข้าวผัดกะเพรา', quantity: 1, unit_price: 60 }],
  total_amount: 60,
  special_instructions: 'ไม่ใส่ถุง ขอซอสเพิ่ม แยกห่อ ขอบคุณครับ ไม่เอาช้อนส้อม',
}

describe('R35 · สติกเกอร์ — Menu/Notice หลัง ":" บรรทัดเดียวกัน + ช่วง Tel→QR แคบ', () => {
  it('source ใช้ valX (คอลัมน์ค่าร่วม) + qrY ผูก min(ขอบหน้า, เส้น Tel+40) — ไม่ใช่ face−M−qrSize ตรง ๆ', () => {
    expect(stickerSrc).toContain('const valX = M + 148')
    expect(stickerSrc).toContain("text: 'Menu :', size: 22, weight: 700")
    expect(stickerSrc).toContain('x: valX, y, text: menuLines[0]')
    expect(stickerSrc).toContain('x: valX, y, text: noticeLines[0]')
    // R41: + off (fluid บวกชดเชย) — ขอบล่างหน้าคงที่ min() ตัวแรกเท่าเดิม
    expect(stickerSrc).toContain('const qrY = Math.min(face - M - qrSize, y + 40 + off)')
    expect(stickerSrc).not.toMatch(/qrY = face - M - qrSize\b/)
  })

  it('pure: notice ยาว 2 บรรทัดหลัง double-colon · QR ห่างจากเส้น Tel ≤40px · ไม่ล้นหน้า 709', () => {
    const ops = stickerDrawList(order)
    const lab = (s: string) => ops.find((o) => o.kind === 'text' && o.text === s) as Extract<StickerOp, { kind: 'text' }> | undefined
    const menuLab = lab('Menu :')
    const noticeLab = lab('Notice :')
    expect(menuLab && noticeLab).toBeTruthy()
    // ค่า Menu/Notice อยู่คอลัมน์ x=164 (หลัง ':') และบรรทัดแรก y เดียวกับป้าย
    const valsAt164 = ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.x === 164)
    expect(valsAt164.length).toBeGreaterThanOrEqual(2)
    expect(valsAt164.some((v) => v.y === menuLab!.y)).toBe(true)
    expect(valsAt164.some((v) => v.y === noticeLab!.y)).toBe(true)
    // notice ยาว = มีค่า 2 บรรทัด (y ต่างกัน 26px)
    const noticeVals = valsAt164.filter((v) => v.y >= noticeLab!.y && v.y < noticeLab!.y + 60)
    expect(noticeVals.length).toBe(2)
    // ช่วงเส้นใต้ Tel → QR ≤ 40px
    const tel = ops.find((o) => o.kind === 'text' && o.text.startsWith('Tel.')) as Extract<StickerOp, { kind: 'text' }>
    const qr = ops.find((o) => o.kind === 'qr') as Extract<StickerOp, { kind: 'qr' }>
    const telLineY = tel.y + 14
    expect(qr.y - telLineY).toBeLessThanOrEqual(40)
    expect(qr.y + qr.size).toBeLessThanOrEqual(STICKER_PX_H)
  })
})

describe('R35 · /menu พรีออเดอร์ — ชิปรอบถูกถอด + เรียงวันใกล้ปัจจุบันก่อน', () => {
  it('banner ไม่ render deliveryRounds chips อีกต่อไป ("ในวงเล็บไม่ต้องแสดง") + ไม่โหลด rounds เปล่า ๆ', () => {
    expect(menuSrc).not.toContain('round.display_name')
    expect(menuSrc).not.toContain('deliveryRounds.map')
    expect(menuSrc).not.toContain('setDeliveryRounds')
    expect(menuSrc).not.toContain('getDeliveryRounds')
    expect(menuSrc).toContain('ในวงเล็บไม่ต้องแสดง')
  })

  it('ordered (แท็บ pre-order) เรียง scheduleMap วันใกล้ก่อน — ไม่มีป้ายวัน = ท้ายแถว', () => {
    expect(menuSrc).toContain("const da = scheduleMap[a.id] ?? ''")
    expect(menuSrc).toContain('return da.localeCompare(db)')
    expect(menuSrc).not.toContain('Number(!!scheduleMap[b.id]) - Number(!!scheduleMap[a.id])')
  })

  it('หน้าแรก preOrderShowcase เรียงวันใกล้วันปัจจุบันก่อน (ก่อน slice(8))', () => {
    expect(homeSrc).toContain("const da = scheduleMap[a.id] ?? ''")
    expect(homeSrc).toContain('return da.localeCompare(db)')
    // อยู่ในบล็อก preOrderShowcase (ก่อน .slice(0, 8))
    const idx = homeSrc.indexOf('const preOrderShowcase')
    const sliceIdx = homeSrc.indexOf('.slice(0, 8)', idx)
    const sortIdx = homeSrc.indexOf('.sort((a, b) =>', idx)
    expect(idx).toBeGreaterThan(-1)
    expect(sortIdx).toBeGreaterThan(idx)
    expect(sliceIdx).toBeGreaterThan(sortIdx)
  })
})
