// ============================================
// Bite Me Baby — R27 unit tests: สติกเกอร์ BMB 40×60 (ใบเสร็จ+ครัว = ใบเดียวกัน)
// ============================================
import { describe, it, expect } from 'vitest'
import {
  buildBmbStickerHtml,
  BMB_STICKER_W_MM,
  BMB_STICKER_H_MM,
  type PrintOrderData,
} from '@/lib/printService'
import printSrc from '@/lib/printService?raw'
import adminSrc from '@/pages/admin/AdminPrintSettings?raw'

const baseOrder: PrintOrderData = {
  order_number: 'BMB-20261030-0007',
  created_at: '2026-10-30T10:00:00+07:00',
  customer_name: 'ลูกค้าทดสอบ <script>',
  customer_phone: '0812345678',
  items: [
    { product_name: 'ข้าวมันไก่', quantity: 2, unit_price: 50 },
    { product_name: 'น้ำเปล่า', quantity: 1, unit_price: 10, special_request: 'ไม่ใส่น้ำแข็ง' },
  ],
  total_amount: 110,
  special_instructions: 'ไม่เผ็ด',
}

describe('สติกเกอร์ BMB 40×60 — แบบฟอร์มตามที่ Owner วาด (Templates-BmB)', () => {
  it('มีป้ายซ้ายครบทุกช่อง + ค่าอ่านจากแบบฟอร์ม (หลัง : เท่านั้น)', async () => {
    const html = await buildBmbStickerHtml(baseOrder)
    expect(html).toContain('BITE ME BABY')
    expect(html).toContain('MORE THAN DELLICIOUS')
    for (const label of ['Order id', 'Date', 'Menu', 'Notice', 'CUSTOMER', 'Tel.', 'SCAN FOR MORE', 'Thank You for love']) {
      expect(html, `label "${label}"`).toContain(label)
    }
    // ค่าจากแบบฟอร์ม
    expect(html).toContain('BMB-20261030-0007')
    expect(html).toContain('ข้าวมันไก่')
    expect(html).toContain('x2')
    expect(html).toContain('ไม่ใส่น้ำแข็ง')
    expect(html).toContain('ไม่เผ็ด')
    expect(html).toContain('0812345678')
    // บล็อก QR ข้อความไทยตรงแบบ
    expect(html).toContain('รายละเอียดการซื้อ')
    expect(html).toContain('สแกนสมาชิกเพื่อสะสมแต้ม')
    expect(html).toContain('รับรางวัลจำนวนมาก')
    expect(BMB_STICKER_W_MM).toBe(40)
    expect(BMB_STICKER_H_MM).toBe(60)
    expect(html).toContain('40mm 60mm')
  })

  it('escapes HTML ของลูกค้า + ไม่มีบรรทัดราคาบนสติกเกอร์', async () => {
    const html = await buildBmbStickerHtml(baseOrder)
    expect(html).not.toContain('<script>')
    const escLt = String.fromCharCode(38, 108, 116, 59) // amp-lt-semicolon
    const escGt = String.fromCharCode(38, 103, 116, 59) // amp-gt-semicolon
    expect(html).toContain(escLt + 'script' + escGt)
    expect(html).not.toContain('฿')
    expect(html).not.toContain('ยอดสุทธิ')
    // QR = data URL หรือ fallback URL ตรง (jsdom ไม่มี canvas → path ใด path หนึ่งต้องมี)
    expect(html).toMatch(/data:image\/|biteme-baby\.com/)
  })

  it('R28: ล้น = ตัดในใบ .sheet ไม่ดันหน้า 2 · SCAN FOR MORE ไม่ wrap · เมนูเกิน 3 รายการ = …', async () => {
    const html = await buildBmbStickerHtml(baseOrder)
    // clamp ต่อใบ (สูง 58.4mm ใน @page 60mm) — ของล้นถูกตัด ไม่ใช่หน้า 2
    expect(html).toContain('.sheet')
    expect(html).toContain('height: 58.4mm')
    expect(html).toContain('overflow: hidden')
    expect(html).toContain('white-space: nowrap') // "SCAN FOR MORE" บรรทัดเดียว
    // เมนู > 3 รายการ → ตัด + …
    const many = await buildBmbStickerHtml({
      ...baseOrder,
      items: Array.from({ length: 8 }, (_, i) => ({ product_name: `เมนู${i + 1}`, quantity: 1, unit_price: 0 })),
    })
    expect(many).toContain('เมนู1')
    expect(many).toContain('เมนู3')
    expect(many).not.toContain('เมนู4')
    expect(many).toContain('…')
  })

  it('ทั้งใบเสร็จและใบสั่งครัว = buildBmbStickerHtml ผ่าน printViaTransport (source contract)', () => {
    expect(printSrc).toMatch(/await buildBmbStickerHtml\(payload\)/)
    expect(printSrc).toMatch(/const sticker = await buildBmbStickerHtml\(order\)/)
    expect(printSrc).toMatch(/await buildBmbStickerHtml\(order\)/)
    expect(printSrc).toMatch(/printViaTransport/)
    // transport = QZ ก่อน fallback dialog
    expect(printSrc).toMatch(/settings\.qzEnabled && settings\.qzPrinterName/)
  })

  it('AdminPrintSettings: QZ panel + ปุ่มทดสอบยิงเทมเพลตสติกเกอร์', () => {
    expect(adminSrc).toContain('qz-tray-panel')
    expect(adminSrc).toContain('handleConnectQz')
    expect(adminSrc).toContain('qz-test-sticker')
    expect(adminSrc).toMatch(/buildBmbStickerHtml\(sampleSticker\(\)\)/)
  })
})
