// ============================================
// Bite Me Baby — SlipReviewPanel D-04 behavior (R1.2 · 2026-10-23)
// ============================================
// แผงตรวจสลิปต้อง "บอกเหตุผลชัดเมื่อยืนยันไม่ได้" (ไม่ใช่กดแล้ว error ลอย ๆ):
//   - ปุ่มยืนยันปิด + แสดงเหตุผลเมื่อ paymentConfirmability บอกว่ายังไม่ได้
//   - ปุ่มเปิดเมื่อมีหลักฐาน (intent processing) พร้อม delegate onConfirmPayment
//
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PaymentIntentLite } from '@/lib/paymentExceptions'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/lib/paymentGateway', () => ({
  getPaymentSlipSignedUrl: vi.fn(async () => null),
}))

import { SlipReviewPanel } from '@/components/admin/SlipReviewPanel'

function order(over: Partial<OrderForm> & { order_number: string }): OrderForm {
  return {
    id: 'o-' + over.order_number, customer_id: 'u', customer_name: 'T', customer_phone: '08',
    delivery_round_id: 'r1', status: 'confirmed', total_amount: 100, delivery_fee: 0,
    payment_method: 'promptpay_qr', payment_status: 'pending', delivery_address: '',
    dropoff_latitude: 0, dropoff_longitude: 0, items: [], created_at: '2026-10-23T10:00:00Z', updated_at: '2026-10-23T10:00:00Z',
    ...over,
  } as unknown as OrderForm
}

function intent(over: Partial<PaymentIntentLite> & { order_number: string }): PaymentIntentLite {
  return {
    status: 'pending', method: 'promptpay_qr', amount: 100, payment_intent_id: 'pi', failure_reason: null,
    updated_at: '2026-10-23T10:00:00Z', ...over,
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

async function renderPanel(orders: OrderForm[], intentsByOrder: Record<string, PaymentIntentLite[]>, onConfirmPayment = vi.fn()) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(SlipReviewPanel, { orders, intentsByOrder, onConfirmPayment }))
  })
  await flush()
  const toggle = container.querySelector('[data-testid="slip-review-toggle"]') as HTMLButtonElement
  await act(async () => { toggle.click() })
  await flush()
  return { onConfirmPayment }
}

beforeEach(() => { vi.clearAllMocks() })

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('R1.2 · SlipReviewPanel — บอกเหตุผลชัดเมื่อยืนยันไม่ได้ (D-04)', () => {
  it('ไม่มีหลักฐาน (intent pending) → ปุ่มยืนยันปิด + บอกเหตุผล "ยังไม่มีหลักฐานการโอน"', async () => {
    const o = order({ order_number: 'S-1' })
    await renderPanel([o], { 'S-1': [intent({ order_number: 'S-1', status: 'pending' })] })
    const btn = container.querySelector('[data-testid="slip-confirm-S-1"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    const reason = container.querySelector('[data-testid="slip-reason-S-1"]')!
    expect(reason.textContent).toContain('ยังไม่มีหลักฐานการโอน')
  })

  it('มีหลักฐานแล้ว (intent processing) → ปุ่มเปิด + กดแล้ว delegate onConfirmPayment', async () => {
    const o = order({ order_number: 'S-2' })
    const { onConfirmPayment } = await renderPanel([o], {
      'S-2': [intent({ order_number: 'S-2', status: 'processing', slip_path: 'u/s.jpg' })],
    })
    const btn = container.querySelector('[data-testid="slip-confirm-S-2"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    await act(async () => { btn.click() })
    expect(onConfirmPayment).toHaveBeenCalledWith('S-2')
  })

  it('ไม่มี intent เลย → เหตุผลบอกให้เปิด /payment (self-heal) · COD ยังไม่ delivered → บอกชัด', async () => {
    const noIntent = order({ order_number: 'S-3', payment_method: 'promptpay_qr' })
    const cod = order({ order_number: 'S-4', payment_method: 'cash_on_delivery', status: 'in_transit' })
    await renderPanel([noIntent, cod], {})
    expect(container.querySelector('[data-testid="slip-reason-S-3"]')!.textContent).toContain('ไม่พบ payment intent')
    expect(container.querySelector('[data-testid="slip-reason-S-4"]')!.textContent).toContain('delivered')
  })

  it('กรองเฉพาะ payment_status=pending — paid/refund ไม่โผล่ในแผง', async () => {
    const pending = order({ order_number: 'S-5' })
    const paid = order({ order_number: 'S-6', payment_status: 'paid' })
    await renderPanel([pending, paid], {})
    const items = container.querySelectorAll('[data-testid="slip-review-item"]')
    expect(items).toHaveLength(1)
    expect(container.textContent).toContain('S-5')
    expect(container.textContent).not.toContain('S-6')
  })
})