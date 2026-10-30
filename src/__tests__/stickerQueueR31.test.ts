// ============================================
// Bite Me Baby — R31/R32 tests: คิวสติกเกอร์ 1 ดวง/ชิ้น + การ์ดราคาจริง + marketing wiring
// ============================================
import { describe, it, expect } from 'vitest'
import { stickerRollForOrder } from '@/lib/stickerQueue'
import { DEFAULT_PRINTER_SETTINGS, type PrintOrderData } from '@/lib/printService'
import { pricesAreReal } from '@/pages/admin/AdminAiStudio'

const order: PrintOrderData = {
  order_number: 'BMB-R31-001',
  created_at: '2026-10-30T20:00:00+07:00',
  customer_name: 'ลูกค้าคิว',
  customer_phone: '0810000000',
  items: [
    { product_name: 'ข้าวมันไก่', quantity: 2, unit_price: 50 },
    { product_name: 'น้ำชา', quantity: 1, unit_price: 15, special_request: 'ไม่หวาน' },
  ],
  total_amount: 115,
  special_instructions: '',
}

describe('R31 — stickerRollForOrder: 1 ดวง ต่อ 1 ชิ้น (ออเดอร์เดียวกันก็แยก)', () => {
  it('quantity 2+1 = 3 ใบ · แต่ละใบมีสินค้าชิ้นเดียว x1 · คง Order id/ลูกค้า', () => {
    const roll = stickerRollForOrder(order)
    expect(roll).toHaveLength(3)
    expect(roll.every((r) => r.items.length === 1 && r.items[0].quantity === 1)).toBe(true)
    expect(roll.map((r) => r.items[0].product_name)).toEqual(['ข้าวมันไก่', 'ข้าวมันไก่', 'น้ำชา'])
    expect(roll.every((r) => r.order_number === 'BMB-R31-001' && r.customer_name === 'ลูกค้าคิว')).toBe(true)
    expect(roll[2].items[0].special_request).toBe('ไม่หวาน')
  })

  it('ไม่มี item = 1 ใบรวม (กันคิวว่าง) · setting autoPrintStickers default เปิด', () => {
    const roll = stickerRollForOrder({ ...order, items: [] })
    expect(roll).toHaveLength(1)
    expect(DEFAULT_PRINTER_SETTINGS.autoPrintStickers).toBe(true)
  })
})

describe('R32 — pricesAreReal: ราคาในแคปชันต้องเป็นของสินค้าจริงเท่านั้น', () => {
  const real = new Set([50, 15, 79])
  it('ราคาจริงผ่าน · ราคาที่ AI แต่งใหม่ = ฟัน', () => {
    expect(pricesAreReal('ข้าวมันไก่ ฿50 น้ำชา ฿15 อร่อย!', real)).toBe(true)
    expect(pricesAreReal('บราวนี่ราคา ฿79 หอมมาก', real)).toBe(true)
    expect(pricesAreReal('พิเศษวันนี้ ฿99 เท่านั้น', real)).toBe(false)
    expect(pricesAreReal('ลดเหลือ 120 บาท คุ้มมาก', real)).toBe(false)
    expect(pricesAreReal('เมนูลด 45 บาท วันนี้', real)).toBe(false)
  })
  it('ไม่มีราคาอ้างอิง = ห้ามมีราคาใด ๆ ใน polished', () => {
    expect(pricesAreReal('แคปชันลอย ๆ ไม่มีตัวเลข', new Set())).toBe(true)
    expect(pricesAreReal('ราคา ฿50 นะ', new Set())).toBe(false)
  })
})

describe('R31/R32 — wiring (source contracts)', () => {
  it('AdminOrders: รับออเดอร์ → autoPrintStickerRoll + import ครบ', async () => {
    const src = (await import('@/pages/admin/AdminOrders?raw')).default as string
    expect(src).toMatch(/void autoPrintStickerRoll\(orderNumber\)/)
    expect(src).toContain('stickerRollForOrder(buildPrintOrderData(full))')
    // R33: offset จาก settings ถูกส่งเข้า printStickerRoll (ทุกใบเลื่อนเท่ากัน) · R34: faceH ด้วย
    expect(src).toContain('printStickerRoll(roll, { offsetY: settings.stickerOffsetYPx ?? 0, faceH: settings.stickerFaceHPx ?? 709 })')
    expect(src).toContain('describeStickerRollError')
  })
  it('AdminPrintSettings: checkbox คิว + preview รูป + คำแนะนำ Incognito/Allow', async () => {
    const src = (await import('@/pages/admin/AdminPrintSettings?raw')).default as string
    expect(src).toContain('auto-print-stickers')
    expect(src).toContain('autoPrintStickers: e.target.checked')
    expect(src).toContain('bt-preview')
    expect(src).toContain('setBtPreview(png)')
    expect(src).toContain('Remember this decision')
    expect(src).toContain('Incognito')
    // R33: ช่องชดเชยฟีด + ปุ่มใบวัดฟีด + default 0
    expect(src).toContain('sticker-offset-ypx')
    expect(src).toContain('stickerOffsetYPx: clampFeedOffset(')
    expect(src).toContain('bt-calibration-print')
    expect(src).toContain('renderCalibrationPng(faceH)')
    expect(src).toContain('clampFeedOffset(settings.stickerOffsetYPx ?? 0)')
    expect(DEFAULT_PRINTER_SETTINGS.stickerOffsetYPx).toBe(0)
    // R34: ช่องความสูงหน้าดวงจริง + default 709 + ใบวัด/เทสต์ใช้ค่า
    expect(src).toContain('sticker-face-hpx')
    expect(src).toContain('stickerFaceHPx: clampFaceHeight(')
    expect(src).toContain('renderStickerPng(sampleSticker(), off, faceH)')
    expect(DEFAULT_PRINTER_SETTINGS.stickerFaceHPx).toBe(709)
  })
  it('AdminMarketing: picker เมนูทั้งหมด + error detail image-gen · AdminAiStudio guard ถูกเรียก', async () => {
    const mk = (await import('@/pages/admin/AdminMarketing?raw')).default as string
    const ai = (await import('@/pages/admin/AdminAiStudio?raw')).default as string
    const imgGen = (await import('../../supabase/functions/image-gen/index?raw')).default as string
    expect(mk).toContain('mk-product-picker')
    expect(mk).toContain("supabase.from('products')")
    expect(mk).toContain('พรีออเดอร์ + เซมเดย์')
    expect(mk).toContain('context?: Response')
    expect(ai).toContain('pricesAreReal(polished, realPrices)')
    expect(ai).toContain('.eq(\'is_available\', true)')
    expect(imgGen).toContain('IMAGE_MODEL_CANDIDATES')
    expect(imgGen).toContain('for (const model of IMAGE_MODEL_CANDIDATES)')
  })
})
