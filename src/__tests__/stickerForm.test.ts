// ============================================
// Bite Me Baby — R56 tests: stickerForm (แปลงออเดอร์ → ช่องแบบฟอร์มสติกเกอร์)
// จุดเดียวที่ HTML (printService) กับ PNG (stickerPng) อ่านร่วมกัน ⇒ สองทางพิมพ์ตรงกัน
// ============================================
import { describe, it, expect } from 'vitest'
import {
  STICKER_SERVICE_LABELS,
  STICKER_PAID_OPTIONS,
  stickerFormFields,
  detectStickerService,
  detectStickerPaid,
  packStickerLines,
} from '@/lib/stickerForm'
import { POS_SERVICE_META } from '@/lib/posApi'
import type { PrintOrderData } from '@/lib/printService'

const base: PrintOrderData = {
  order_number: 'BMB-20261102-0009',
  created_at: '2026-11-02T18:30:00+07:00',
  customer_name: 'สมหญิง ใจดี',
  customer_phone: '0812345678',
  items: [{ product_name: 'ข้าวมันไก่', quantity: 2, unit_price: 50 }],
  total_amount: 100,
  delivery_address: '99 ถนนมหาราช อำเภอเมือง จันทบุรี',
  special_instructions: 'ไม่ใส่ถุง',
  order_mode: 'SAME_DAY',
  payment_method: 'promptpay_qr',
  delivery_method: 'self_delivery',
}

describe('R56 — stickerForm: แปลงออเดอร์เป็นช่องแบบฟอร์ม', () => {
  it('ป้าย 3 หมวดบริการตรงกับ POS_SERVICE_META (กันสองฝั่ง drift)', () => {
    expect(STICKER_SERVICE_LABELS).toEqual({
      dine_in: POS_SERVICE_META.dine_in.label,
      takeaway: POS_SERVICE_META.takeaway.label,
      pickup: POS_SERVICE_META.pickup.label,
    })
  })

  it('ช่อง [PAID] = B/T · QR PROMPTPAY · COD ตามแบบ + mapping วิธีชำระ (ครบทุกค่า DB)', () => {
    expect(STICKER_PAID_OPTIONS.map((p) => p.label)).toEqual(['B/T', 'QR PROMPTPAY', 'COD'])
    expect(detectStickerPaid({ ...base, payment_method: 'promptpay_qr' })).toBe('promptpay_qr')
    expect(detectStickerPaid({ ...base, payment_method: 'cash_on_delivery' })).toBe('cash_on_delivery')
    expect(detectStickerPaid({ ...base, payment_method: 'bank_transfer' })).toBe('bank_transfer')
    // Owner: "ต้องใส่ข้อมูลให้ครบทุกอัน ... ลิงก์จากรายละเอียดจริง" ⇒ ทุกค่าใน enum DB
    // (promptpay_qr | credit_card | cash_on_delivery) ต้องมีช่อง = ใบเสร็จติ๊กครบเสมอ ไม่เว้นวรรคเปล่า
    expect(detectStickerPaid({ ...base, payment_method: 'credit_card' })).toBe('bank_transfer')
    expect(detectStickerPaid({ ...base, payment_method: 'CREDIT_CARD' })).toBe('bank_transfer')
    expect(detectStickerPaid({ ...base, payment_method: undefined })).toBeNull()
  })

  it('R56 (Owner): Date/TIME = เวลาปัจจุบัน ณ ตอนพิมพ์ — ไม่อ่าน created_at (POS ไม่มีเวลาเวลารอบส่ง)', () => {
    const at = new Date('2026-11-05T09:07:00+07:00')
    const f = stickerFormFields({ ...base, created_at: '2020-01-01T00:00:00+07:00' }, at)
    expect(f.time).toBe('09:07')
    expect(f.date).toContain('11/2569') // พ.ย. 2569 (เลข พ.ศ. ไทย)
    expect(f.date).not.toContain('2020') // ห้ามเอา created_at มาแสดง
    // ไม่ส่ง at (production) = default เวลาปัจจุบันตอนเรียก
    const d = stickerFormFields(base)
    expect(d.date).toContain('2569')
    expect(d.time).toMatch(/^\d{1,2}:\d{2}$/)
  })

  it('detectStickerService: หัวป้าย POS → หมวดนั้น · pickup → รับที่ร้าน · ช่องทางส่ง = สั่งกลับบ้าน', () => {
    expect(detectStickerService({ ...base, special_instructions: 'ทานที่ร้าน โต๊ะ 3' })).toBe('dine_in')
    expect(detectStickerService({ ...base, special_instructions: 'สั่งกลับบ้าน' })).toBe('takeaway')
    expect(detectStickerService({ ...base, special_instructions: 'รับที่ร้าน' })).toBe('pickup')
    expect(detectStickerService({ ...base, delivery_method: 'pickup' })).toBe('pickup')
    expect(detectStickerService({ ...base, delivery_method: 'grab_rider' })).toBe('takeaway')
    // ไม่มีทั้งหัว POS และไม่มีช่องทาง → null (ไม่ติ๊กวงกลมไหน)
    expect(detectStickerService({ ...base, special_instructions: '', delivery_method: undefined })).toBeNull()
  })

  it('stickerFormFields: ค่าทุกช่องแทนตัวอย่างในแบบ (หลัง : เสมอ)', () => {
    const f = stickerFormFields(base)
    expect(f.orderId).toBe('BMB-20261102-0009')
    expect(f.date).toMatch(/\d/)
    expect(f.time).toMatch(/^\d{1,2}:\d{2}$/)
    expect(f.modeSameDay).toBe(true)
    expect(f.modePreOrder).toBe(false)
    expect(f.service).toBe('takeaway')
    expect(f.orderListLines).toEqual(['ข้าวมันไก่ x2'])
    expect(f.notice).toBe('ไม่ใส่ถุง')
    expect(f.attn).toBe('สมหญิง ใจดี (0812345678)')
    expect(f.add).toBe('99 ถนนมหาราช อำเภอเมือง จันทบุรี')
    expect(f.totalNet).toBe('100.00')
    expect(f.paid).toBe('promptpay_qr')
  })

  it('PRE_ORDER + ที่อยู่ว่าง + ยอดทศนิยม = ถูกต้อง', () => {
    const f = stickerFormFields({ ...base, order_mode: 'PRE_ORDER', delivery_address: '', total_amount: 1234.5 })
    expect(f.modePreOrder).toBe(true)
    expect(f.modeSameDay).toBe(false)
    expect(f.add).toBe('-')
    expect(f.totalNet).toBe('1,234.50')
  })

  it('ไม่มีข้อมูลเลย = ทุกช่อง "-" / null ไม่ใช่ค่าว่างหรือ NaN (ยกเว้น Date/TIME = เวลาพิมพ์เสมอ)', () => {
    const f = stickerFormFields({ order_number: 'BMB-X', items: [], total_amount: 0 })
    expect(f.date).toContain('2569') // Date/TIME = เวลาตอนพิมพ์ (default now) — ไม่ใช่ "-"
    expect(f.time).toMatch(/^\d{1,2}:\d{2}$/)
    expect(f.orderId).toBe('BMB-X')
    expect(f.orderListLines).toEqual(['-'])
    expect(f.notice).toBe('-')
    expect(f.attn).toBe('-')
    expect(f.add).toBe('-')
    expect(f.totalNet).toBe('0.00')
    expect(f.service).toBeNull()
    expect(f.paid).toBeNull()
    expect(f.modePreOrder).toBe(false)
    expect(f.modeSameDay).toBe(false)
  })

  it('packStickerLines: ≤ 3 บรรทัด · เกิน = ตัดด้วย … · ว่าง = -', () => {
    expect(packStickerLines([])).toEqual(['-'])
    expect(packStickerLines(['เมนู1 x1'])).toEqual(['เมนู1 x1'])
    // สั้นทุกตัว = รวมเป็นบรรทัดเดียว
    expect(packStickerLines(['a x1', 'b x1'])).toEqual(['a x1 · b x1'])
    const many = packStickerLines(Array.from({ length: 8 }, (_, i) => `เมนู${i + 1} x1`))
    expect(many).toHaveLength(3)
    expect(many[2]).toContain('…')
    expect(many.join(' ')).not.toContain('เมนู8')
    expect(many[0].startsWith('เมนู1')).toBe(true)
  })
})