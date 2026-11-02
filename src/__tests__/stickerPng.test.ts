// ============================================
// Bite Me Baby — R30 tests: stickerDrawList (layout pure) + ขอบ 472×709
// ============================================
import { describe, it, expect } from 'vitest'
import { stickerDrawList, calibrationDrawList, clampFeedOffset, clampFaceHeight, stickerPageHeight, STICKER_PX_W, STICKER_PX_H, type StickerOp } from '@/lib/stickerPng'
import type { PrintOrderData } from '@/lib/printService'
import stickerSrc from '@/lib/stickerPng.ts?raw'

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
  it('R56: ป้ายครบทุกช่องแบบฟอร์มใหม่ + ค่าจากแบบฟอร์ม', () => {
    const ops = stickerDrawList(order)
    const t = texts(ops)
    expect(t).toContain('BITE ME BABY')
    expect(t).toContain('" More Than Dellicious "')
    expect(t).toContain('Date :')
    expect(t).toContain('TIME :')
    expect(t.some((x) => x.includes('Pre-Order'))).toBe(true)
    expect(t.some((x) => x.includes('Same Day'))).toBe(true)
    expect(t.some((x) => x.includes('ทานที่ร้าน'))).toBe(true)
    expect(t.some((x) => x.includes('สั่งกลับบ้าน'))).toBe(true)
    expect(t.some((x) => x.includes('รับที่ร้าน'))).toBe(true)
    expect(t).toContain('ORDER ID')
    expect(t).toContain('ORDER LIST')
    expect(t).toContain('NOTICE')
    expect(t).toContain('[ DELIVERY / CUSTOMER ]')
    expect(t).toContain('Attn :')
    expect(t).toContain('Add :')
    expect(t).toContain('[ TOTAL NET ] :')
    expect(t.some((x) => x.startsWith('[PAID] :'))).toBe(true)
    expect(t.some((x) => x.includes('QR PROMPTPAY'))).toBe(true)
    expect(t.some((x) => x.includes('COD'))).toBe(true)
    expect(t.some((x) => x.startsWith('สมชาย ใจดี'))).toBe(true)
    expect(t.some((x) => x.includes('0819998888'))).toBe(true)
    expect(t.some((x) => x.includes('THB'))).toBe(true)
    expect(t).toContain('SCAN FOR MORE')
    // แบบใหม่ (ตามภาพ Owner) = ไม่มี 3 บรรทัดไทยใต้ QR เหมือนแบบเก่า
    expect(t).not.toContain('รายละเอียดการซื้อ')
    expect(t).toContain('Thank You for love !')
    expect(t).toContain('ข้าวมันไก่ x1')
    expect(t).toContain('น้ำชา x2 (ไม่หวาน)')
    expect(t).toContain('BMB-20261030-0042')
  })

  it('R51: rasterize stroke ทุกตัวอักษร (กันตัวหนา) — strokeText+fillText ทุก op พร้อม lineJoin/lineCap มน', () => {
    const src = stickerSrc
    expect(src).toContain('ctx.strokeText(op.text, op.x, op.y)')
    expect(src).toContain('ctx.fillText(op.text, op.x, op.y)')
    expect(src).toContain("ctx.lineJoin = 'round'")
    expect(src).toContain('ctx.lineWidth = Math.max(1, Math.round(op.size / 14))')
    // stroke ต้องครอบคลุมทุก text op (รวม CUSTOMER/ตัวเล็ก) — ไม่มี guard ตัดทิ้งเฉพาะบางช่อง
    expect(src).not.toMatch(/if \(op\.size[^)]*\)\s*ctx\.strokeText/)
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
    // R35: เมนู ≤2 บรรทัดหลัง ':' → '…' ถูกต่อท้ายบรรทัดที่ 2 (ไม่ใช่บรรทัดเดี่ยวเหมือนเดิม)
    expect(t.some((x) => x.includes('…'))).toBe(true)

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

  it('stickerPageHeight (R41): หน้า = 709 เท่านั้น — offset ไม่ยืดหน้า (บวก/ติดลบ เหมือนกันหมด · หลักฐาน: +62/ใบ = ข้ามดวงสะสม)', () => {
    expect(stickerPageHeight(0)).toBe(709)
    expect(stickerPageHeight(100)).toBe(709)
    expect(stickerPageHeight(-40)).toBe(709)
    expect(stickerPageHeight(9999)).toBe(709)
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

  it('stickerPageHeight(offset, faceH): R41 หน้า = faceH เท่านั้น (offset ไม่ยืดหน้า — หลักฐาน: +62/ใบทำเพี้ยนฟีด) · png ↔ SetPageSize ผูกกัน', () => {
    expect(stickerPageHeight(0, 660)).toBe(660)
    expect(stickerPageHeight(80, 660)).toBe(660) // R41: ไม่ grow — offset อยู่ในหน้าเดิม
    expect(stickerPageHeight(30, 709)).toBe(709)
    expect(stickerPageHeight(-40, 660)).toBe(660)
    expect(stickerPageHeight(0, 500)).toBe(640) // clamp ขอบล่าง
  })

  it('R56/R41 offset=60: เนื้อบนเลื่อนลง 60 · QR ผูกขอบล่างหน้า (face−M−qrSize · ย่อเอง 110..150) · ไม่เลย face · bg = face', () => {
    const ops = stickerDrawList(order, 60, 709)
    const qr = ops.find((o) => o.kind === 'qr')
    const head = ops.find((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.text === 'BITE ME BABY')
    // หัวเลื่อนลง 60 (y = 16+30+60)
    expect(head?.y).toBe(16 + 30 + 60)
    // R56: QR ผูกขอบล่างหน้าเสมอ + ย่อขนาดเองให้พอดีใต้เนื้อหา (มีทางไม่มีทางล้นหน้า)
    expect(qr && qr.kind === 'qr' ? qr.y + qr.size : -1).toBe(709 - 16)
    expect(qr && qr.kind === 'qr' ? qr.size : -1).toBeGreaterThanOrEqual(110)
    expect(qr && qr.kind === 'qr' ? qr.size : -1).toBeLessThanOrEqual(150)
    const bg = ops[0]
    expect(bg.kind === 'rect' && bg.h).toBe(709)
    for (const op of ops) {
      const yEnd = op.kind === 'line' ? Math.max(op.y1, op.y2)
        : op.kind === 'rect' ? op.y + op.h
          : op.kind === 'qr' ? op.y + op.size
            : op.y
      expect(yEnd).toBeLessThanOrEqual(709)
    }
  })

  it('stickerDrawList faceH=660: QR ผูกขอบล่าง 660−16 (ย่อให้พอดีใต้เนื้อหา) · ทุก op ≤ หน้า · bg = 660', () => {
    const ops = stickerDrawList(order, 0, 660)
    const qr = ops.find((o) => o.kind === 'qr')
    const paid = ops.find((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.text.startsWith('[PAID] :'))
    expect(qr && qr.kind === 'qr' ? qr.y + qr.size : -1).toBe(660 - 16)
    // QR ไม่ทับเนื้อหา (เริ่มหลังแถว [PAID] + ระยะห่าง)
    expect(qr && qr.kind === 'qr' ? qr.y : -1).toBeGreaterThanOrEqual((paid?.y ?? 0) + 22)
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
  it('R41/R56 offset +80 = เนื้อบนลง 80px (text/lines) · QR ยังผูกขอบล่างหน้า (ไม่ดันเกินขอบ) · bg = 709 คงที่', () => {
    const base = stickerDrawList(order)
    const moved = stickerDrawList(order, 80)
    expect(moved).toHaveLength(base.length)
    // bg = element แรก — R41: เท่า face เดิม 709 (ไม่ grow 789)
    const bg = moved[0]
    expect(bg.kind).toBe('rect')
    expect(bg.kind === 'rect' && bg.h).toBe(709)
    const qrIdx = base.findIndex((o) => o.kind === 'qr')
    const baseQr = base[qrIdx]
    const movedQr = moved[qrIdx]
    // R56: QR ผูกขอบล่างหน้าเสมอ (face − M − qrSize ที่ย่อเอง 110..150) — offset ไม่ดัน QR เกินขอบ
    expect(baseQr.kind === 'qr' ? baseQr.y + baseQr.size : -1).toBe(709 - 16)
    expect(movedQr.kind === 'qr' ? movedQr.y + movedQr.size : -1).toBe(709 - 16)
    for (let i = 1; i < base.length; i++) {
      const a = base[i]
      const b = moved[i]
      expect(b.kind).toBe(a.kind)
      if (i < qrIdx) {
        // เนื้อหาส่วนบน = เลื่อน +80 ทุกตัว
        if (a.kind === 'line' && b.kind === 'line') {
          expect(b.y1).toBe(a.y1 + 80)
          expect(b.y2).toBe(a.y2 + 80)
        } else if (a.kind === 'text' && b.kind === 'text') {
          expect(b.y).toBe(a.y + 80)
        }
      } else if (i > qrIdx && b.kind === 'text') {
        // ข้อความในบล็อก QR ผูกกับ qrY+qrSize ของใบตัวเอง (ขนาด QR ย่อได้ → ห้ามเป็น +80 ตรง ๆ)
        const mq = movedQr.kind === 'qr' ? movedQr : null
        expect(!!mq && b.y >= mq.y && b.y <= mq.y + mq.size).toBe(true)
      }
      const yEnd = b.kind === 'line' ? Math.max(b.y1, b.y2)
        : b.kind === 'rect' ? b.y + b.h
          : b.kind === 'qr' ? b.y + b.size
            : b.y
      expect(yEnd).toBeLessThanOrEqual(709)
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
    // ล็อก at = เวลาพิมพ์คงที่ — ไม่งั้น Date/TIME = now สองครั้งคนละรอบนาที = toEqual หลุดเอง
    const AT = new Date('2026-11-05T09:07:00+07:00')
    expect(stickerDrawList(order, 0, undefined, AT)).toEqual(stickerDrawList(order, undefined, undefined, AT))
    expect(stickerDrawList(order, 0, undefined, AT)).toHaveLength(stickerDrawList(order, undefined, undefined, AT).length)
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

describe('R56 — ORDER LIST/NOTICE หลัง ":" คอลัมน์เดียวกัน (≤3/1 บรรทัด) · QR ผูกขอบล่าง', () => {
  it('ค่า ORDER LIST/NOTICE เริ่ม x=186 บน y เดียวกับป้าย · ORDER LIST ≤ 3 บรรทัด · NOTICE = 1 บรรทัด', () => {
    const ops = stickerDrawList(order)
    const lab = (s: string) => ops.find((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.text === s)
    const listLab = lab('ORDER LIST')
    const noticeLab = lab('NOTICE')
    expect(listLab && noticeLab).toBeTruthy()
    const listY = listLab!.y
    const noticeY = noticeLab!.y
    const colX = 16 + 170 // คอลัมน์ค่า = 15.5mm (ตรง .f.col ฝั่ง HTML)
    const listVals = ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.x === colX && o.y >= listY && o.y < noticeY)
    expect(listVals.length).toBeGreaterThanOrEqual(1)
    expect(listVals.length).toBeLessThanOrEqual(3) // label 1 + ต่อ 2 = ตามแบบ
    expect(listVals.some((v) => v.y === listY)).toBe(true) // ค่าบรรทัดแรก = บรรทัดเดียวกับป้าย
    // บรรทัดต่อของ ORDER LIST = ':' ชิดซ้าย (x=M) ตามแบบ Owner
    const contColons = ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.text === ':' && o.x === 16 && o.y > listY && o.y < noticeY)
    expect(contColons.length).toBe(listVals.length - 1)
    // NOTICE = 1 บรรทัดเท่านั้น (แบบใหม่ไม่ต่อบรรทัดใต้ป้าย)
    const noticeVals = ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.x === colX && o.y >= noticeY && o.y < noticeY + 40)
    expect(noticeVals.length).toBe(1)
    expect(noticeVals.some((v) => v.y === noticeY)).toBe(true)
  })

  it('notice ยาว = ยังเป็นบรรทัดเดียว (ไม่ต่อบรรทัด) · QR ผูกขอบล่าง ไม่ล้นขอบล่างหน้า', () => {
    const long: PrintOrderData = { ...order, special_instructions: 'ไม่ใส่ถุง ขอซอสเพิ่ม แยกห่อ ขอบคุณครับ ไม่เอาช้อนส้อม' }
    const ops = stickerDrawList(long)
    const noticeLab = ops.find((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.text === 'NOTICE')
    const ny = noticeLab?.y ?? -1
    const noticeVals = ops.filter((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.x === 16 + 170 && o.y >= ny && o.y < ny + 40)
    expect(noticeVals.length).toBe(1)
    const paid = ops.find((o): o is Extract<StickerOp, { kind: 'text' }> => o.kind === 'text' && o.text.startsWith('[PAID] :'))
    const qr = ops.find((o) => o.kind === 'qr')
    // QR เริ่มหลังแถวสุดท้าย ([PAID]) และจบที่ขอบล่างหน้าพอดี — ไม่ล้น
    expect(qr && qr.kind === 'qr' ? qr.y : -1).toBeGreaterThanOrEqual((paid?.y ?? 0) + 22)
    expect(qr && qr.kind === 'qr' ? qr.y + qr.size : -1).toBe(STICKER_PX_H - 16)
    expect(qr && qr.kind === 'qr' ? qr.y + qr.size : 999).toBeLessThanOrEqual(STICKER_PX_H)
  })
})