// ============================================
// Bite Me Baby — M5: payment_intents single read path (2026-10-22)
// ============================================
// paymentExceptions ต้องอ่าน payment_intents ผ่าน paymentGateway.getPaymentIntents
// ตัวเดียว — ห้ามมี query ส่วนตัวของ payment_intents ใน paymentExceptions อีก
// (เลิกสองทาง: เดิม UI ใช้ getPaymentIntents แต่ paymentExceptions ยิง supabase เอง)
//
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import { supabase } from '@/lib/supabase'
import { getPaymentIntentsFor } from '@/lib/paymentExceptions'
import { getPaymentIntents } from '@/lib/paymentGateway'
import paymentExceptionsSrc from '../lib/paymentExceptions.ts?raw'

const T = '2026-10-22T10:00:00Z'

function intentRow(orderNumber: string, over: Record<string, unknown> = {}) {
  return {
    id: `i-${orderNumber}-${Math.random().toString(36).slice(2, 8)}`,
    order_number: orderNumber,
    amount: 100,
    currency: 'thb',
    status: 'pending',
    method: 'promptpay_qr',
    provider: 'promptpay',
    metadata: { reference: `TXN-${orderNumber}` },
    created_at: T,
    updated_at: T,
    ...over,
  }
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
})

describe('M5 — payment_intents อ่านผ่าน paymentGateway ตัวเดียว', () => {
  it('getPaymentIntentsFor ได้เฉพาะ order ที่ขอ (batch filter)', async () => {
    await supabase.from('payment_intents').insert([
      intentRow('A1'), intentRow('A2'), intentRow('B1'),
    ])
    const rows = await getPaymentIntentsFor(['A1', 'B1'])
    expect(rows.map((r) => r.order_number).sort()).toEqual(['A1', 'B1'])
    const onlyA2 = await getPaymentIntentsFor(['A2'])
    expect(onlyA2).toHaveLength(1)
    expect(onlyA2[0].order_number).toBe('A2')
  })

  it('map เป็น PaymentIntentLite ครบ — slip_path/metadata ไม่หาย', async () => {
    await supabase.from('payment_intents').insert([
      intentRow('S1', { slip_path: 'u1/slip.jpg', slip_uploaded_at: T, status: 'processing' }),
    ])
    const rows = await getPaymentIntentsFor(['S1'])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      order_number: 'S1',
      status: 'processing',
      slip_path: 'u1/slip.jpg',
      slip_uploaded_at: T,
    })
    expect((rows[0].metadata as Record<string, unknown>).reference).toBe('TXN-S1')
  })

  it('order ไม่มี intent → [] (ให้ classifyPaymentException รายงาน MISSING_INTENT ต่อ)', async () => {
    await supabase.from('payment_intents').insert([intentRow('X1')])
    const rows = await getPaymentIntentsFor(['X1', 'GHOST'])
    expect(rows).toHaveLength(1)
    expect(rows[0].order_number).toBe('X1')
  })

  it('ลิสต์ว่าง → [] ทันที (ไม่ยิง query)', async () => {
    expect(await getPaymentIntentsFor([])).toEqual([])
  })

  it('getPaymentIntents({ orderNumbers }) = เส้นอ่านเดียวที่ทุกหน้าใช้ร่วมกัน', async () => {
    await supabase.from('payment_intents').insert([
      intentRow('G1'), intentRow('G2'), intentRow('G3'),
    ])
    const rows = await getPaymentIntents({ orderNumbers: ['G2', 'G3'] })
    expect(rows.map((r) => r.order_number).sort()).toEqual(['G2', 'G3'])
  })
})

describe('M5 — source guarantee: paymentExceptions ไม่มี query payment_intents ของตัวเอง', () => {
  it('paymentExceptions.ts ไม่มี from(\'payment_intents\') และเรียก getPaymentIntents', () => {
    expect(paymentExceptionsSrc).not.toContain("from('payment_intents')")
    expect(paymentExceptionsSrc).toContain('getPaymentIntents({ orderNumbers })')
  })
})