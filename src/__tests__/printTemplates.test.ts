// ============================================
// Bite Me Baby — Print templates unit tests (migration 128)
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
// Pure builders: Thai rendering inputs, pickup-code presence, price policy.
// ============================================
import { describe, it, expect } from 'vitest'
import {
  buildReceiptHtml,
  buildKitchenTicketHtml,
  escapeHtml,
  formatThaiBaht,
  PrintOrderData,
} from '@/lib/printService'

const baseOrder: PrintOrderData = {
  order_number: 'BMB-20261019-0001',
  created_at: '2026-10-19T10:00:00+07:00',
  customer_name: 'ทดสอบ <script>',
  customer_phone: '0812345678',
  items: [
    { product_name: 'ข้าวมันไก่', quantity: 2, unit_price: 50 },
    { product_name: 'น้ำเปล่า', quantity: 1, unit_price: 10, special_request: 'ไม่ใส่น้ำแข็ง' },
  ],
  subtotal: 110,
  discount_amount: 10,
  delivery_fee: 0,
  service_fee: 0,
  tax_amount: 0,
  total_amount: 100,
  payment_method: 'cash_on_delivery',
  payment_status: 'paid',
  delivery_method: 'pickup',
  pickup_code: '123456',
  order_mode: 'SAME_DAY',
}

describe('printService — receipt builder', () => {
  it('contains order number, totals and Thai labels', () => {
    const html = buildReceiptHtml(baseOrder)
    expect(html).toContain('BMB-20261019-0001')
    expect(html).toContain('ใบเสร็จรับเงิน')
    expect(html).toContain('ยอดสุทธิ')
    expect(html).toContain('ข้าวมันไก่')
    expect(html).toContain('x2')
  })

  it('shows pickup code block ONLY for pickup orders', () => {
    const pickupHtml = buildReceiptHtml(baseOrder)
    expect(pickupHtml).toContain('123456')
    const deliveryHtml = buildReceiptHtml({ ...baseOrder, delivery_method: 'self_delivery', pickup_code: null })
    expect(deliveryHtml).not.toContain('กรุณาแสดงรหัสรับอาหาร')
  })

  it('escapes HTML in customer-supplied fields', () => {
    const html = buildReceiptHtml(baseOrder)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('shows ฟรี label when delivery fee is zero', () => {
    const html = buildReceiptHtml({ ...baseOrder, delivery_method: 'self_delivery' })
    expect(html).toContain('ฟรี')
  })
})

describe('printService — kitchen ticket builder', () => {
  it('lists items with quantities but NEVER prices', () => {
    const html = buildKitchenTicketHtml(baseOrder)
    expect(html).toContain('คิวครัว')
    expect(html).toContain('ข้าวมันไก่')
    expect(html).toContain('ไม่ใส่น้ำแข็ง')
    expect(html).not.toContain('฿') // no money amounts on the kitchen ticket
    expect(html).not.toContain('ยอดสุทธิ')
  })
})

describe('printService — helpers', () => {
  it('escapeHtml neutralizes markup', () => {
    expect(escapeHtml('<b>&"</b>')).toBe('&lt;b&gt;&amp;&quot;&lt;/b&gt;')
  })

  it('formatThaiBaht formats with 2 decimals', () => {
    expect(formatThaiBaht(1234.5)).toContain('1,234.50')
    expect(formatThaiBaht(null)).toContain('0.00')
  })
})