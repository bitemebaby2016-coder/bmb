// ============================================
// Bite Me Baby — R27 unit tests: สติกเกอร์ BMB 40×60 (ใบเสร็จ+ครัว = ใบเดียวกัน)
// · R66 (2026-11-04): ไม่ใส่สโตรค 3 คำ (.brand/.sec/.scan) · ORDER LIST block 4 แถว · sheet 58.8mm
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
import { B1_PRO_MODEL, STICKER_40x60_300DPI, stickerSize, describeNiimbotError } from '@/lib/niimbotBt'

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
  it('R56: ป้ายครบทุกช่องตามแบบฟอร์มใหม่ + ค่าอ่านจากแบบฟอร์ม (แทนตัวอย่างหลัง :)', async () => {
    const html = await buildBmbStickerHtml(baseOrder)
    expect(html).toContain('BITE ME BABY')
    expect(html).toContain('More Than Dellicious')
    for (const label of [
      'Date :', 'TIME :', 'Pre-Order', 'Same Day',
      'ทานที่ร้าน', 'สั่งกลับบ้าน', 'รับที่ร้าน',
      'ORDER ID', 'ORDER LIST', 'NOTICE', '[ DELIVERY / CUSTOMER ]',
      'Attn :', 'Add :', '[ TOTAL NET ] :', '[PAID] :',
      'B/T', 'QR PROMPTPAY', 'COD',
      'SCAN FOR MORE', 'Thank You for love',
    ]) {
      expect(html, `label "${label}"`).toContain(label)
    }
    // ค่าจากแบบฟอร์ม (แทนตัวอย่างในแบบ)
    expect(html).toContain('BMB-20261030-0007')
    expect(html).toContain('ข้าวมันไก่')
    expect(html).toContain('x2')
    expect(html).toContain('ไม่ใส่น้ำแข็ง')
    expect(html).toContain('ไม่เผ็ด')
    expect(html).toContain('0812345678')
    expect(html).toContain('THB')
    // แบบใหม่ (ตามภาพ Owner) = ไม่มี 3 บรรทัดไทยใต้ QR เหมือนแบบเก่า
    expect(html).not.toContain('รายละเอียดการซื้อ')
    expect(BMB_STICKER_W_MM).toBe(40)
    expect(BMB_STICKER_H_MM).toBe(60)
    expect(html).toContain('40mm 60mm')
  })

  it('R56 (Owner): Date/TIME = เวลา ณ ตอนพิมพ์ (POS ไม่มีเวลาเวลารอบส่ง) — ไม่ใช่ created_at ของออเดอร์', async () => {
    const at = new Date('2026-11-05T09:07:00+07:00')
    const html = await buildBmbStickerHtml(baseOrder, at) // created_at ของ baseOrder = 30 ต.ค. 2569
    expect(html).toContain('09:07')
    expect(html).toContain('11/2569')
    expect(html).not.toContain('30/10/2569')
    // ไม่ส่ง at (production/ปุ่มทดสอบ) = default เวลาปัจจุบันตอนเรียก
    const live = await buildBmbStickerHtml(baseOrder)
    expect(live).toContain(new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }))
  })
  it('R51+R66: stroke ทุกตัวอักษรยกเว้น 3 คำที่ Owner สั่งไม่ใส่ (.brand/.sec/.scan) — rule เดียว', async () => {
    const html = await buildBmbStickerHtml(baseOrder)
    expect(html).toContain('-webkit-text-stroke: 0.35px #000')
    // R66 (Owner 2026-11-04): "Bite me baby , DELIVERY/CUSTOMER, SCAN FOR MORE ไม่ต้องใส่สโตรค"
    expect(html).toContain('.sheet *:not(.brand):not(.sec):not(.scan)')
    expect(html).not.toContain('.sheet, .sheet *') // เลิกครอบ .brand/.sec/.scan
    // source contract: อยู่ใน buildBmbStickerHtml (ใช้ทั้ง QZ + dialog) — stroke ชั้นเดียว ห้ามซ้ำ
    expect(printSrc).toContain('-webkit-text-stroke: 0.35px #000')
    expect(html.match(/-webkit-text-stroke/g) || []).toHaveLength(1)
    expect(html).toContain('paint-order: stroke fill')
  })

  it('R59+R66: แถว ทานที่ร้าน/สั่งกลับบ้าน/รับที่ร้าน = เท่าหัวข้อ Pre-Order/Same Day · ใหญ่สุดตามวัด + [PAID] + ช่องไฟเท่ากัน', async () => {
    const html = await buildBmbStickerHtml(baseOrder)
    // ทั้งสองแถว = 9px (เท่ากัน · ใหญ่สุดที่พอดี 145px — หลักฐาน e2e/r59_sticker_fit.json: svc@9=142.98 · @10 ล้น)
    expect(html).toContain('.opts.mode { font-size: 9px; }')
    expect(html).toContain('.opts.svc { font-size: 9px; }')
    // แถว [PAID] = 7px (ใหญ่สุดที่พอดี: @7=140.75 ✓ · @7.8=154.8 ล้น) — วงกลม ○/● ใหญ่ขึ้นตามแถว
    expect(html).toContain('.paid { display: flex; margin: .4px 0; font-size: 7px;')
    // R66: ช่องไฟระหว่างบรรทัดเท่ากัน — margin .4px ทุกแถว (.dtrow/.opts/.f/.sec/.paid)
    expect(html).toContain('/* R66: ช่องไฟระหว่างบรรทัดเท่ากัน — margin .4px ทุกแถว')
    expect((html.match(/margin: \.4px 0/g) || []).length).toBeGreaterThanOrEqual(5)
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

  it('R28+R66: ล้น = ตัดในใบ .sheet (58.8mm) ไม่ดันหน้า 2 · SCAN ไม่ wrap · ORDER LIST block 4 แถวคงที่', async () => {
    const html = await buildBmbStickerHtml(baseOrder)
    // clamp ต่อใบ (สูง 58.8mm ใน @page 60mm — R66: เว้นล่าง 2.2mm + margin .6mm) — ของล้นถูกตัด ไม่ใช่หน้า 2
    expect(html).toContain('.sheet')
    expect(html).toContain('height: 58.8mm')
    expect(html).toContain('padding-bottom: 2.2mm') // R66: เว้นว่างด้านล่าง ~5%
    expect(html).toContain('overflow: hidden')
    expect(html).toContain('white-space: nowrap') // "SCAN FOR MORE" บรรทัดเดียว
    // R66: ORDER LIST = block 4 แถวคงที่ — baseOrder (2 รายการ → 2 แถว) เหลือแถวว่าง olblank จองไว้
    expect(html).toContain('olblank')
    expect((html.match(/olblank/g) || []).length).toBeGreaterThanOrEqual(1)
    // 8 รายการ = 4 แถวเต็ม (ไหลต่อเนื่อง ไม่ใช่ 1 รายการ 1 บรรทัด) — แสดงครบ
    const many = await buildBmbStickerHtml({
      ...baseOrder,
      items: Array.from({ length: 8 }, (_, i) => ({ product_name: `เมนู${i + 1}`, quantity: 1, unit_price: 0 })),
    })
    expect(many).toContain('เมนู1')
    expect(many).toContain('เมนู8')
    // เกิน 4 แถว = ตัดด้วย … (รายการถัดไปไม่ถูกแสดง)
    const over = await buildBmbStickerHtml({
      ...baseOrder,
      items: Array.from({ length: 11 }, (_, i) => ({ product_name: `เมนู${i + 1}`, quantity: 1, unit_price: 0 })),
    })
    expect(over).toContain('…')
    expect(over).not.toContain('เมนู9')
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
    expect(adminSrc).toContain('qz-status')
    expect(adminSrc).toContain('handleConnectQz')
    expect(adminSrc).toContain('qz-test-sticker')
    expect(adminSrc).toMatch(/buildBmbStickerHtml\(sampleSticker\(\)\)/)
    // R29: auto-connect ตอนเปิดหน้า + วิธีใช้พับเป็น details (กระชับ)
    expect(adminSrc).toMatch(/void handleConnectQz\(true\)/)
    expect(adminSrc).toContain('<details')
  })
})

describe('R30 — Niimbot Bluetooth path (driver ภาษาจีน reverse แล้ว)', () => {
  it('preset B1 Pro + ขนาดสติกเกอร์ 40×60@300dpi = 472×709 (สูตร sizeFromMm)', () => {
    expect(B1_PRO_MODEL.task).toBe('v4')
    expect(B1_PRO_MODEL.name_prefixes).toContain('B1')
    expect(STICKER_40x60_300DPI.w_px).toBe(Math.round((40 * 300) / 25.4))
    expect(STICKER_40x60_300DPI.h_px).toBe(Math.round((60 * 300) / 25.4))
    expect(STICKER_40x60_300DPI.w_px).toBe(472)
    expect(STICKER_40x60_300DPI.h_px).toBe(709)
  })

  it('R33 — stickerSize(offset): h_px ผูก stickerPageHeight เสมอ (png ↔ SetPageSize ห้ามเพี้ยน)', () => {
    expect(stickerSize()).toEqual({ w_px: 472, h_px: 709, offset_y_px: 0 })
    expect(stickerSize(0)).toEqual(STICKER_40x60_300DPI)
    expect(stickerSize(120).h_px).toBe(709) // R41: offset ไม่ยืดหน้าแล้ว (หน้า = faceH)
    expect(stickerSize(-40).h_px).toBe(709) // ติดลบ = หน้าเท่าเดิม
    expect(stickerSize(99999).h_px).toBe(709) // R41: clamp หน้า = faceH (เดิมบวก offset เติบโต)
    for (const off of [0, 50, -20, 300]) {
      expect(stickerSize(off).w_px).toBe(472)
      expect(stickerSize(off).h_px).toBe(709) // R41: ทุก offset = หน้าเท่ากัน (png ↔ SetPageSize คงที่)
      expect(stickerSize(off).offset_y_px).toBe(0) // offset ทำที่ render — lib ห้ามซ้ำ
    }
    // R34: faceH ความสูงหน้าดวงจริง — h_px ผูก stickerPageHeight(offset, faceH)
    expect(stickerSize(0, 660).h_px).toBe(660)
    expect(stickerSize(50, 660).h_px).toBe(660) // R41: faceH + ไม่บวก offset
    expect(stickerSize(-40, 660).h_px).toBe(660)
    expect(stickerSize(0, 660).w_px).toBe(472)
    expect(stickerSize(0, 660).offset_y_px).toBe(0)
  })

  it('describeNiimbotError แปลสถานะหลักเป็นคำไทย', () => {
    expect(describeNiimbotError(new Error('User cancelled the requestDevice() chooser'))).toContain('เลือกเครื่อง')
    expect(describeNiimbotError(new Error('print not confirmed: PageEnd missing'))).toContain('เช็คกระดาษ')
    expect(describeNiimbotError(new Error('GATT operation failed'))).toContain('Bluetooth')
    expect(describeNiimbotError(new Error('x'.repeat(300))).length).toBeLessThanOrEqual(160)
  })

  it('โมดูล + หน้าตั้งค่าผูกกันครบ (source contract)', async () => {
    const btSrc = (await import('@/lib/niimbotBt?raw')).default as string
    const admin = (await import('@/pages/admin/AdminPrintSettings?raw')).default as string
    expect(btSrc).toContain("import('niimbot-web-bluetooth')")
    expect(btSrc).toContain('printImage')
    expect(btSrc).toContain('identify')
    expect(admin).toContain('bt-panel')
    expect(admin).toContain('handleBtTest')
    expect(admin).toContain('renderStickerPng(sampleSticker(), off, faceH)')
    // R33: size ผูกกับ stickerPageHeight (png ↔ SetPageSize ตรงกันเสมอ)
    expect(btSrc).toContain('stickerSize(opts?.offsetY ?? 0, opts?.faceH)')
    expect(btSrc).toContain('stickerPageHeight')
  })
})
