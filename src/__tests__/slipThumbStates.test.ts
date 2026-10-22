// ============================================
// Bite Me Baby — SlipThumb explicit states (A2 + A7(ก.) · 2026-10-22)
// ============================================
// A7(ก.): "—" เงียบต้องหายไป — ทุกกรณีมีสถานะชัดเจน: ตรวจแล้ว / ไม่ต้องตรวจสลิป /
// รอตรวจ / รอสลิปจากลูกค้า / ไม่พบ payment intent / โหลดสลิปไม่ได้
// M5: SlipThumb รับ intents จาก props (พ่อแม่ query ครั้งเดียว — ไม่ self-fetch)
//
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PaymentIntentLite } from '@/lib/paymentExceptions'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({
  getPaymentSlipSignedUrl: vi.fn(),
}))

vi.mock('@/lib/paymentGateway', () => ({
  getPaymentSlipSignedUrl: m.getPaymentSlipSignedUrl,
}))

import { SlipThumb } from '@/components/admin/SlipThumb'

function intent(over: Partial<PaymentIntentLite> & { order_number: string }): PaymentIntentLite {
  return {
    status: 'pending', method: 'promptpay_qr', amount: 100,
    payment_intent_id: 'pi_1', failure_reason: null,
    updated_at: '2026-10-22T10:00:00Z',
    slip_path: null, slip_uploaded_at: null, metadata: null,
    ...over,
  }
}

let container: HTMLDivElement
let root: Root

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

async function renderThumb(props: {
  orderNumber?: string
  paymentStatus?: string
  paymentMethod?: string
  intents: PaymentIntentLite[]
}) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(SlipThumb, {
      orderNumber: props.orderNumber ?? 'BMB-TEST-1',
      paymentStatus: props.paymentStatus ?? 'pending',
      paymentMethod: props.paymentMethod ?? 'promptpay_qr',
      intents: props.intents,
    }))
  })
  await flush()
  return container
}

beforeEach(() => {
  vi.clearAllMocks()
  m.getPaymentSlipSignedUrl.mockResolvedValue(null)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('A7(ก.) — SlipThumb ไม่มี "—" เงียบ: ทุกกรณีมีสถานะชัดเจน', () => {
  it('ไม่มี payment intents เลย → "⚠ ไม่พบ payment intent" (ไม่ใช่ขีดเงียบ)', async () => {
    const c = await renderThumb({ intents: [] })
    expect(c.querySelector('[data-testid="slip-missing-intent"]')).toBeTruthy()
    expect(c.textContent).toContain('ไม่พบ payment intent')
    expect(c.textContent).not.toContain('—')
  })

  it('paid → "✓ ตรวจแล้ว"', async () => {
    const c = await renderThumb({
      paymentStatus: 'paid',
      intents: [intent({ order_number: 'BMB-TEST-1' })],
    })
    const v = c.querySelector('[data-testid="slip-verified"]')
    expect(v).toBeTruthy()
    expect(v?.textContent).toContain('ตรวจแล้ว')
  })

  it('refund → สถานะคืนเงินชัดเจน (ยังไม่ใช่ "ตรวจแล้ว" เปล่า ๆ)', async () => {
    const c = await renderThumb({
      paymentStatus: 'refund',
      intents: [intent({ order_number: 'BMB-TEST-1' })],
    })
    expect(c.querySelector('[data-testid="slip-verified"]')?.textContent).toContain('คืนเงินแล้ว')
  })

  it('COD ยัง pending → "ไม่ต้องตรวจสลิป (เก็บเงินปลายทาง)"', async () => {
    const c = await renderThumb({
      paymentMethod: 'cash_on_delivery',
      intents: [intent({ order_number: 'BMB-TEST-1', method: 'cash_on_delivery' })],
    })
    expect(c.querySelector('[data-testid="slip-no-check"]')?.textContent).toContain('เก็บเงินปลายทาง')
  })

  it('promptpay pending + สลิปโหลดได้ → โชว์รูป + "⏳ รอตรวจ"', async () => {
    m.getPaymentSlipSignedUrl.mockResolvedValue('https://cdn.example/slip.jpg')
    const c = await renderThumb({
      intents: [intent({ order_number: 'BMB-TEST-1', slip_path: 'u1/slip.jpg', metadata: { reference: 'TXN-77' } })],
    })
    expect(c.querySelector('[data-testid="slip-thumb-img"]')).toBeTruthy()
    expect(c.querySelector('[data-testid="slip-pending"]')?.textContent).toContain('รอตรวจ')
    expect(c.textContent).toContain('TXN-77')
  })

  it('มีสลิปแต่ signed URL ไม่ออก → "⚠ โหลดสลิปไม่ได้" ไม่ใช่หายเงียบ', async () => {
    m.getPaymentSlipSignedUrl.mockResolvedValue(null)
    const c = await renderThumb({
      intents: [intent({ order_number: 'BMB-TEST-1', slip_path: 'u1/slip.jpg' })],
    })
    expect(c.querySelector('[data-testid="slip-error"]')).toBeTruthy()
    expect(c.textContent).toContain('โหลดสลิปไม่ได้')
    expect(c.textContent).not.toContain('—')
  })

  it('promptpay pending ยังไม่มีสลิป/refs → "⏳ รอสลิปจากลูกค้า"', async () => {
    const c = await renderThumb({
      intents: [intent({ order_number: 'BMB-TEST-1' })],
    })
    expect(c.querySelector('[data-testid="slip-awaiting-slip"]')?.textContent).toContain('รอสลิปจากลูกค้า')
  })

  it('signed URL ที่ throw → "⚠ โหลดสลิปไม่ได้" (catch ไม่เงียบ)', async () => {
    m.getPaymentSlipSignedUrl.mockRejectedValue(new Error('storage RLS denied'))
    const c = await renderThumb({
      intents: [intent({ order_number: 'BMB-TEST-1', slip_path: 'u1/slip.jpg' })],
    })
    expect(c.querySelector('[data-testid="slip-error"]')).toBeTruthy()
    expect(c.textContent).not.toContain('—')
  })
})