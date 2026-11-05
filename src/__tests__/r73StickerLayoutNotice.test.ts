// ============================================
// Bite Me Baby — R73 tests (Owner 2026-11-05 ดึก):
//   ① ช่องไฟ 15 บรรทัดก่อน QR เท่ากัน (baseline Δ30 คงที่ทุกแถว)
//   ② เส้นคั่น 3 เส้น = กลางช่องว่าง ไม่ทับตัวอักษร (เดิมเส้น 2 ทับ delivery · เส้น 3 ทับ total)
//   ③ NOTICE พิมพ์ข้อมูลจากลิงก์จริงของลูกค้าด้วย (special_instructions + แชต + โน้ตรายเมนู)
//      — เดิม NOTICE รับเฉพาะ special_instructions = ใบจริงพิมพ์ "NOTICE : -" เสมอ
// ============================================
import { describe, it, expect } from 'vitest'
import { stickerDrawList, STICKER_PX_H, type StickerOp } from '@/lib/stickerPng'
import { stickerFormFields, collectOrderNotices } from '@/lib/stickerForm'
import { buildBmbStickerHtml, type PrintOrderData } from '@/lib/printService'
import printSrc from '@/lib/printService?raw'
import queueSrc from '@/lib/stickerQueue?raw'
import formSrc from '@/lib/stickerForm?raw'

const order: PrintOrderData = {
  order_number: 'BMB-20261105-0001',
  created_at: '2026-11-05T10:00:00+07:00',
  customer_name: 'ทดสอบ R73',
  customer_phone: '0800000000',
  items: [
    { product_name: 'ข้าวมันไก่', quantity: 1, unit_price: 50, special_request: 'ไม่เผ็ด' },
    { product_name: 'น้ำชา', quantity: 1, unit_price: 15, customizations: { notice: 'แยกช้อน' } },
  ],
  total_amount: 65,
  special_instructions: 'รับช้อนส้อม',
  customerMessages: 'ขอผักเยอะ ๆ',
}

function textOps(ops: StickerOp[]) {
  return ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text')
}

describe('R73 ① — 15 บรรทัดก่อน QR ช่องไฟเท่ากัน (baseline Δ30 คงที่ทุกแถว)', () => {
  it('brand → [PAID] = ตารางเดียว ห่างกัน 30px เท่ากันทุกบรรทัด (16 baseline · ใต้ brand = 15 บรรทัด)', () => {
    // 8 รายการสั้น = ORDER LIST เต็ม 4 แถว → ทุกแถวมี op ให้นับ (แถวว่างไม่มี text op)
    const full: PrintOrderData = {
      ...order,
      items: Array.from({ length: 8 }, (_, i) => ({ product_name: `เมนู${i + 1}`, quantity: 1, unit_price: 10 })),
    }
    const ops = stickerDrawList(full)
    const ys = [...new Set(
      textOps(ops)
        .filter((t) => t.text !== 'SCAN FOR MORE' && t.text !== 'Thank You for love !')
        .map((t) => t.y),
    )].sort((a, b) => a - b)
    expect(ys.length).toBe(16) // brand + 15 บรรทัดก่อน QR
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1], `บรรทัดที่ ${i} (${ys[i - 1]} → ${ys[i]})`).toBe(30)
    }
  })

  it('offset ทุกค่า = จังหวะบรรทัดเท่ากันเสมอ (เลื่อนทั้งตาราง ไม่เปลี่ยนช่องไฟ)', () => {
    const full: PrintOrderData = {
      ...order,
      items: Array.from({ length: 8 }, (_, i) => ({ product_name: `เมนู${i + 1}`, quantity: 1, unit_price: 10 })),
    }
    for (const off of [0, 20, -20, 60]) {
      const ops = stickerDrawList(full, off, STICKER_PX_H)
      const ys = [...new Set(
        textOps(ops)
          .filter((t) => t.text !== 'SCAN FOR MORE' && t.text !== 'Thank You for love !')
          .map((t) => t.y),
      )].sort((a, b) => a - b)
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1], `off=${off}`).toBe(30)
    }
  })
})

describe('R73 ② — เส้นคั่น 3 เส้น = กลางช่องว่างระหว่างแถว (ห้ามทับอักษร)', () => {
  it('ทุกเส้นไม่คร่อมแถบตัวอักษรใดเลย (เดิมเส้น 2 ทับ delivery · เส้น 3 ทับ total)', () => {
    const ops = stickerDrawList(order)
    const lines = ops.filter((o): o is Extract<StickerOp, { kind: 'line' }> => o.kind === 'line')
    expect(lines.length).toBe(3)
    for (const l of lines) {
      for (const t of textOps(ops)) {
        // แถบตัวอักษรแบบ conservative = [y − size, y + 5] · เส้นหนา 2px = [y1 − 1, y1 + 1]
        const overlap = l.y1 - 1 < t.y + 5 && l.y1 + 1 > t.y - t.size
        expect(overlap, `เส้น y=${l.y1} ทับ "${t.text}" (baseline ${t.y}, size ${t.size})`).toBe(false)
      }
    }
  })

  it('ตำแหน่งเส้น = ใต้ descender แถวบนและเหนือหัวแถวถัดไป (rule2 ก่อน DELIVERY 21px · rule3 ก่อน TOTAL 20px)', () => {
    const ops = stickerDrawList(order)
    const lines = ops
      .filter((o): o is Extract<StickerOp, { kind: 'line' }> => o.kind === 'line')
      .map((l) => l.y1)
      .sort((a, b) => a - b)
    const lab = (s: string) => textOps(ops).find((t) => t.text === s)!.y
    // rule2 = DELIVERY.y − 21 − 2 · rule3 = TOTAL.y − 20 − 2
    expect(lines[1]).toBe(lab('[ DELIVERY / CUSTOMER ]') - 21 - 2)
    expect(lines[2]).toBe(lab('[ TOTAL NET ] :') - 20 - 2)
  })
})

describe('R73 ③ — NOTICE พิมพ์ข้อมูลจากลิงก์จริงของลูกค้า (ทุกแหล่ง · dedup · fallback "-")', () => {
  it('collectOrderNotices = special_instructions + ข้อความแชตลูกค้า + โน้ตรายเมนู (special_request + customizations.notice)', () => {
    expect(collectOrderNotices(order)).toBe('รับช้อนส้อม · ขอผักเยอะ ๆ · ไม่เผ็ด · แยกช้อน')
  })

  it('ข้อความซ้ำ = แสดงครั้งเดียว · ว่างทุกแหล่ง = "-"', () => {
    const dup: PrintOrderData = {
      ...order,
      items: [],
      special_instructions: 'ไม่เผ็ด',
      customerMessages: 'ไม่เผ็ด · ขอผักเยอะ ๆ',
    }
    expect(collectOrderNotices(dup)).toBe('ไม่เผ็ด · ขอผักเยอะ ๆ')
    expect(collectOrderNotices({ order_number: 'X', items: [], total_amount: 0 })).toBe('-')
  })

  it('เดิม: special_instructions อย่างเดียว = ค่าเดิมไม่เปลี่ยน (ออเดอร์ POS/เดิมพิมพ์เหมือนเดิม)', () => {
    const f = stickerFormFields({
      order_number: 'P', items: [{ product_name: 'ก', quantity: 1, unit_price: 0 }], total_amount: 0,
      special_instructions: 'ไม่ใส่ถุง',
    })
    expect(f.notice).toBe('ไม่ใส่ถุง')
  })

  it('stickerFormFields + PNG (stickerPng) + HTML (buildBmbStickerHtml) = ชุด NOTICE เดียวกัน', async () => {
    const merged = 'รับช้อนส้อม · ขอผักเยอะ ๆ · ไม่เผ็ด · แยกช้อน'
    expect(stickerFormFields(order).notice).toBe(merged)
    const ops = stickerDrawList(order)
    expect(textOps(ops).map((t) => t.text)).toContain(merged)
    const html = await buildBmbStickerHtml(order)
    expect(html).toContain(merged)
  })

  it('source contract: ทุกเส้นทางพิมพ์จริงเติมโน้ตแชตลูกค้าก่อน render (withCustomerChatNotes)', () => {
    expect(printSrc).toMatch(/const payload = await withCustomerChatNotes\(buildPrintOrderData\(order\)\)/)
    expect((printSrc.match(/withCustomerChatNotes/g) || []).length).toBeGreaterThanOrEqual(4)
    expect(queueSrc).toContain('fetchCustomerChatNotes')
    // จุดแปลงเดียวของ NOTICE = collectOrderNotices (HTML + PNG ใช้ร่วมกัน)
    expect(formSrc).toContain('notice: collectOrderNotices(o)')
  })
})