// ============================================
// Bite Me Baby — R30 tests: stickerDrawList (layout pure) + ขอบ 472×709
// ============================================
import { describe, it, expect } from 'vitest'
import { stickerDrawList, STICKER_PX_W, STICKER_PX_H, type StickerOp } from '@/lib/stickerPng'
import type { PrintOrderData } from '@/lib/printService'

const order: PrintOrderData = {
  order_number: 'BMB-20261030-0042',
  created_at: '2026-10-30T12:00:00+07:00',
  customer_name: 'สมชาย ใจดี',
  customer_phone: '0819998888',
  items: [
    { product_name: 'ข้าวมันไก่', quantity: 1, unit_price: 50 },
    { product_name: 'น้ำชา', quantity: 2, unit_price: 15, special_request: 'ไม่หวาน' },
  ],
  total_amount: 80,
  special_instructions: 'ไม่ใส่ถุง',
}

function texts(ops: StickerOp[]): string[] {
  return ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text').map((o) => o.text)
}

describe('stickerDrawList — layout บนผืน 472×709 (40×60 @300dpi)', () => {
  it('มีป้ายครบทุกช่อง + ค่าจากแบบฟอร์ม', () => {
    const ops = stickerDrawList(order)
    const t = texts(ops)
    expect(t).toContain('BITE ME BABY')
    expect(t).toContain('" MORE THAN DELLICIOUS "')
    expect(t.some((x) => x.startsWith('Order id'))).toBe(true)
    expect(t.some((x) => x.startsWith('Menu'))).toBe(true)
    expect(t.some((x) => x.startsWith('Notice'))).toBe(true)
    expect(t).toContain('CUSTOMER : สมชาย ใจดี')
    expect(t.some((x) => x.startsWith('Tel.'))).toBe(true)
    expect(t).toContain('SCAN FOR MORE')
    expect(t).toContain('รายละเอียดการซื้อ')
    expect(t).toContain('Thank You for love !')
    expect(t).toContain('ข้าวมันไก่ x1')
    expect(t).toContain('น้ำชา x2 (ไม่หวาน)')
    expect(t).toContain('BMB-20261030-0042')
  })

  it('เมนูเกิน 3 รายการ = ตัด … · ทุกพิกัดอยู่ในขอบ (ไม่ล้นใบ)', () => {
    const many: PrintOrderData = {
      ...order,
      items: Array.from({ length: 7 }, (_, i) => ({ product_name: 'เมนู' + (i + 1), quantity: 1, unit_price: 10 })),
    }
    const ops = stickerDrawList(many)
    const t = texts(ops)
    expect(t.some((x) => x.startsWith('เมนู1'))).toBe(true)
    expect(t.some((x) => x.startsWith('เมนู3'))).toBe(true)
    expect(t.some((x) => x.startsWith('เมนู4'))).toBe(false)
    expect(t).toContain('…')

    for (const op of ops) {
      if (op.kind === 'text') {
        expect(op.x).toBeGreaterThanOrEqual(0)
        expect(op.x).toBeLessThanOrEqual(STICKER_PX_W)
        expect(op.y).toBeGreaterThanOrEqual(0)
        expect(op.y).toBeLessThanOrEqual(STICKER_PX_H)
      } else if (op.kind === 'qr') {
        expect(op.x + op.size).toBeLessThanOrEqual(STICKER_PX_W)
        expect(op.y + op.size).toBeLessThanOrEqual(STICKER_PX_H)
      }
    }
    // QR op อยู่จริง + ไม่ชนส่วนหัว
    const qr = ops.find((o) => o.kind === 'qr') as Extract<StickerOp, { kind: 'qr' }> | undefined
    expect(qr).toBeTruthy()
    expect(qr!.y).toBeGreaterThan(300)
  })
})