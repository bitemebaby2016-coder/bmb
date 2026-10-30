// ============================================
// Bite Me Baby — R30 tests: stickerDrawList (layout pure) + ขอบ 472×709
// ============================================
import { describe, it, expect } from 'vitest'
import { stickerDrawList, calibrationDrawList, clampFeedOffset, clampFaceHeight, stickerPageHeight, STICKER_PX_W, STICKER_PX_H, type StickerOp } from '@/lib/stickerPng'
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

describe('R33 — clampFeedOffset / stickerPageHeight (ชดเชยฟีด)', () => {
  it('clamp: ปัดเป็นจำนวนเต็ม · ขอบ −40..300 · NaN/undefined → 0', () => {
    expect(clampFeedOffset(0)).toBe(0)
    expect(clampFeedOffset(12.6)).toBe(13)
    expect(clampFeedOffset(-3.4)).toBe(-3)
    expect(clampFeedOffset(-999)).toBe(-40)
    expect(clampFeedOffset(9999)).toBe(300)
    expect(clampFeedOffset(NaN)).toBe(0)
    expect(clampFeedOffset(undefined as unknown as number)).toBe(0)
  })

  it('stickerPageHeight: บวก = หน้าเติบโตตาม offset · 0/ติดลบ = 709 เดิม (ไม่หด)', () => {
    expect(stickerPageHeight(0)).toBe(709)
    expect(stickerPageHeight(100)).toBe(809)
    expect(stickerPageHeight(-40)).toBe(709)
    expect(stickerPageHeight(9999)).toBe(709 + 300)
  })
})

describe('R34 — clampFaceHeight / หน้า = ความสูงหน้าดวงจริง (แก้ภาพข้ามดวง)', () => {
  it('clamp: ปัดจำนวนเต็ม · ขอบ 640..760 · NaN/undefined → 709 (มาตรฐาน 40×60)', () => {
    expect(clampFaceHeight(709)).toBe(709)
    expect(clampFaceHeight(660.4)).toBe(660)
    expect(clampFaceHeight(640)).toBe(640)
    expect(clampFaceHeight(760)).toBe(760)
    expect(clampFaceHeight(-999)).toBe(640)
    expect(clampFaceHeight(9999)).toBe(760)
    expect(clampFaceHeight(NaN)).toBe(STICKER_PX_H)
    expect(clampFaceHeight(undefined as unknown as number)).toBe(STICKER_PX_H)
  })

  it('stickerPageHeight(offset, faceH): หน้า = faceH + max(0, offset) — png ↔ SetPageSize ผูกกัน', () => {
    expect(stickerPageHeight(0, 660)).toBe(660)
    expect(stickerPageHeight(80, 660)).toBe(740)
    expect(stickerPageHeight(-40, 660)).toBe(660) // offset ติดลบ = หน้าเท่าเดิม
    expect(stickerPageHeight(0, 500)).toBe(640) // clamp ขอบล่าง
  })

  it('stickerDrawList faceH=660: QR ผูกขอบล่างจริง (660−16−197=447) · ทุก op ≤ หน้า · bg = 660', () => {
    const ops = stickerDrawList(order, 0, 660)
    const qr = ops.find((o) => o.kind === 'qr')
    expect(qr && qr.kind === 'qr' ? qr.y : -1).toBe(447)
    const bg = ops[0]
    expect(bg.kind === 'rect' && bg.h).toBe(660)
    for (const op of ops) {
      const yEnd = op.kind === 'line' ? Math.max(op.y1, op.y2)
        : op.kind === 'rect' ? op.y + op.h
          : op.kind === 'qr' ? op.y + op.size
            : op.y
      expect(yEnd).toBeLessThanOrEqual(660)
    }
  })

  it('calibrationDrawList(faceH=660): เส้นขอบล่าง = 659 · ป้าย px หยุดก่อนขอบล่าง (ไม่มีป้าย 600)', () => {
    const ops = calibrationDrawList(660)
    const lines = ops.filter((o) => o.kind === 'line')
    const ts = texts(ops)
    expect(lines.some((l) => l.kind === 'line' && l.y1 === 659 && l.w === 6)).toBe(true)
    expect(ts.some((t) => t.startsWith('500px'))).toBe(true)
    expect(ts.some((t) => t.startsWith('600px'))).toBe(false) // 600 > 659−80 → ไม่ทับขอบ
  })
})

describe('R33 — stickerDrawList(offset) ทุก op เลื่อนเท่ากัน · bg = เต็มหน้าใหม่', () => {
  it('offset +80 = ทุก op ลง 80px (lines ใช้ y1/y2) · bg สูงเท่า pageH', () => {
    const base = stickerDrawList(order)
    const moved = stickerDrawList(order, 80)
    expect(moved).toHaveLength(base.length)
    // bg = element แรก — สูง 709+80
    const bg = moved[0]
    expect(bg.kind).toBe('rect')
    expect(bg.kind === 'rect' && bg.h).toBe(789)
    for (let i = 1; i < base.length; i++) {
      const a = base[i]
      const b = moved[i]
      expect(b.kind).toBe(a.kind)
      if (a.kind === 'line' && b.kind === 'line') {
        expect(b.y1).toBe(a.y1 + 80)
        expect(b.y2).toBe(a.y2 + 80)
      } else if (a.kind !== 'line' && b.kind !== 'line') {
        expect(b.kind === 'text' || b.kind === 'qr' || b.kind === 'rect' ? b.y : NaN).toBe(a.kind === 'text' || a.kind === 'qr' || a.kind === 'rect' ? a.y + 80 : NaN)
      }
      // ทุก op ต้องไม่เกินหน้าใหม่
      const yEnd = b.kind === 'line' ? Math.max(b.y1, b.y2)
        : b.kind === 'rect' ? b.y + b.h
          : b.kind === 'qr' ? b.y + b.size
            : b.y
      expect(yEnd).toBeLessThanOrEqual(789)
    }
    // หัวเรื่อง baseline เดิม 46 → 126 (ไม่ติดเพดาน)
    const head = moved.find((o) => o.kind === 'text' && o.text === 'BITE ME BABY')
    expect(head && head.kind === 'text' ? head.y : 0).toBe(126)
  })

  it('offset −40 = ทุก op ขึ้น 40px · หัวเรื่องไม่ติดหลังคา (46−40=6 ≥ 0)', () => {
    const moved = stickerDrawList(order, -40)
    const head = moved.find((o) => o.kind === 'text' && o.text === 'BITE ME BABY')
    expect(head && head.kind === 'text' ? head.y : 999).toBe(6)
    const bg = moved[0]
    expect(bg.kind === 'rect' && bg.h).toBe(709) // ติดลบ = หน้าเท่าเดิม
    // ทุกอย่างยังอยู่ในหน้า (ไม่ติดเพดาน) — ด้านล่างมี margin ว่าง
    for (const op of moved.slice(1)) {
      const yEnd = op.kind === 'line' ? Math.max(op.y1, op.y2)
        : op.kind === 'qr' ? op.y + op.size
          : op.kind === 'rect' ? op.y + op.h
            : op.y
      expect(yEnd).toBeLessThanOrEqual(709)
    }
  })

  it('offset 0 = ผลเป๊ะกับ default (ไม่เปลี่ยนพฤติกรรมเดิม)', () => {
    expect(stickerDrawList(order, 0)).toEqual(stickerDrawList(order))
    expect(stickerDrawList(order)).toHaveLength(stickerDrawList(order, 0).length)
  })
})

describe('R33 — calibrationDrawList (ใบวัดฟีด)', () => {
  it('มีเส้นขีดทุก 20px ถึงขอบล่าง + ป้าย px/mm + คำอ่านค่า', () => {
    const ops = calibrationDrawList()
    const lines = ops.filter((o) => o.kind === 'line')
    const ts = texts(ops)
    expect(lines.length).toBeGreaterThanOrEqual(35) // 709/20 ≈ 35 เส้น + เส้นขอบล่าง
    // เส้นขอบบน (y=0) + เส้นขอบล่าง (y=708) = หนาสุด
    expect(lines.some((l) => l.kind === 'line' && l.y1 === 0 && l.w === 5)).toBe(true)
    expect(lines.some((l) => l.kind === 'line' && l.y1 === 708 && l.w === 6)).toBe(true)
    expect(ts).toContain('0px ≈ 0.0mm')
    expect(ts.some((t) => t.startsWith('600px'))).toBe(true)
    expect(ts.some((t) => t.includes('ใบวัดฟีด'))).toBe(true)
    expect(ts.some((t) => t.includes('ใส่เลขนั้นเป็นชดเชยฟีด'))).toBe(true)
    // ทุกอย่างในขอบ 472×709
    for (const op of ops) {
      if (op.kind === 'text') {
        expect(op.x).toBeGreaterThanOrEqual(0)
        expect(op.x).toBeLessThanOrEqual(STICKER_PX_W)
        expect(op.y).toBeGreaterThanOrEqual(0)
        expect(op.y).toBeLessThanOrEqual(STICKER_PX_H)
      } else if (op.kind === 'line') {
        expect(op.x2).toBeLessThanOrEqual(STICKER_PX_W)
        expect(Math.max(op.y1, op.y2)).toBeLessThanOrEqual(STICKER_PX_H)
      }
    }
  })

  it('ไม่มี op ชนิด qr (ไม่โหลด qrcode เปล่า ๆ)', () => {
    expect(calibrationDrawList().some((o) => o.kind === 'qr')).toBe(false)
  })
})