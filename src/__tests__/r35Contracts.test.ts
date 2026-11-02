// ============================================
// Bite Me Baby — R35 contracts (Owner 2026-10-31) · R56 (2026-11-02) ปรับส่วนสติกเกอร์ตามแบบฟอร์มใหม่
// 1) สติกเกอร์ (R56): ค่า ORDER LIST/NOTICE หลัง ':' คอลัมน์เดียวกัน (≤3/1 บรรทัด) · QR ผูกขอบล่างหน้า
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

describe('R56 · สติกเกอร์ — ค่าหลัง ":" คอลัมน์เดียวกัน (ORDER LIST ≤3 / NOTICE =1) + QR ผูกขอบล่าง', () => {
  it('source: ใช้ stickerFormFields (จุดเดียวกับ HTML) + คอลัมน์ค่า colX + QR ผูกขอบล่างหน้า', () => {
    // จุดแปลงเดียว = สองทางพิมพ์ (HTML + PNG) อ่านชุดค่าเดียวกันเสมอ
    expect(stickerSrc).toContain('const f = stickerFormFields(o, at)')
    expect(stickerSrc).toContain('const colX = M + 170')
    expect(stickerSrc).toContain("text: 'ORDER LIST', size: 20, weight: 700")
    expect(stickerSrc).toContain('x: colX, y, text: ln, size: 19')
    expect(stickerSrc).toContain('x: colX, y, text: f.notice, size: 19')
    // บล็อกต่อของ ORDER LIST = ':' ชิดซ้าย (x = M) ตามแบบ Owner
    expect(stickerSrc).toContain("x: M, y, text: ':', size: 20, weight: 700")
    // R56: QR = ผูกขอบล่างหน้าจริง + ย่อขนาดเองให้พอดีใต้เนื้อหา (แทนสูตร Tel+40 แบบเก่า)
    expect(stickerSrc).toContain('const qrY = face - M - qrSize')
    expect(stickerSrc).toContain('const qrSize = Math.max(110, Math.min(150, Math.round(avail)))')
    expect(stickerSrc).not.toContain('const valX = M + 148')
  })

  it('pure: ค่า ORDER LIST/NOTICE อยู่คอลัมน์ x=186 บรรทัดแรก y เดียวกับป้าย · NOTICE = 1 บรรทัด · QR ไม่ล้น 709', () => {
    const ops = stickerDrawList(order)
    const lab = (s: string) => ops.find((o) => o.kind === 'text' && o.text === s) as Extract<StickerOp, { kind: 'text' }> | undefined
    const listLab = lab('ORDER LIST')
    const noticeLab = lab('NOTICE')
    expect(listLab && noticeLab).toBeTruthy()
    // ค่า ORDER LIST/NOTICE อยู่คอลัมน์ x=186 (หลัง ':') และบรรทัดแรก y เดียวกับป้าย
    const valsAt186 = ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.x === 186)
    expect(valsAt186.length).toBeGreaterThanOrEqual(3) // ORDER ID + ORDER LIST + NOTICE
    expect(valsAt186.some((v) => v.y === listLab!.y)).toBe(true)
    expect(valsAt186.some((v) => v.y === noticeLab!.y)).toBe(true)
    // R56: notice ยาว = ยังเป็นบรรทัดเดียว (แบบใหม่ไม่ต่อบรรทัดใต้ป้าย)
    const noticeVals = valsAt186.filter((v) => v.y >= noticeLab!.y && v.y < noticeLab!.y + 40)
    expect(noticeVals.length).toBe(1)
    // QR ผูกขอบล่างหน้า + เริ่มหลังแถวสุดท้าย [PAID] — ไม่ล้นหน้า
    const paid = ops.find((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.text.startsWith('[PAID] :'))
    const qr = ops.find((o) => o.kind === 'qr') as Extract<StickerOp, { kind: 'qr' }>
    expect(qr.y + qr.size).toBe(STICKER_PX_H - 16)
    expect(qr.y).toBeGreaterThanOrEqual((paid?.y ?? 0) + 22)
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
