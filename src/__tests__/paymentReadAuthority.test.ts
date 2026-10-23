// ============================================
// Bite Me Baby — R3 (D-08/P0-1 · migration 138): payment_intents read authority
// ============================================
// สัญญาที่ต้องคง:
//   1. getPaymentIntents อ่านผ่าน RPC get_payment_intents_for_orders เท่านั้น
//      (ตาราง payment_intents ถูก REVOKE สำหรับ authenticated — 034)
//   2. read failure = THROW (ERR_PAYMENT_INTENTS_READ) — ห้ามคืน [] เงียบอีก
//      (ต้นเหตุ D-08: permission denied โดนกลืน → แผงตรวจสลิปบอด + dedupe ตาบอด)
//   3. dedupe ของ createPaymentIntent = server-side (migration 138) — แถว ACTIVE
//      ที่สองไม่ถูกสร้าง แม้ client จะกดซ้ำ/timeout แล้ว retry
//   4. confirm_offline_payment เลือกแถว 'processing' (มีหลักฐาน) ก่อนแถว
//      'completed' ที่ใหม่กว่า (กับดัก 841/205)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
import { getPaymentIntents, createPaymentIntent, confirmPayment } from '@/lib/paymentGateway'
import { getPaymentIntentsFor } from '@/lib/paymentExceptions'
import paymentGatewaySrc from '../lib/paymentGateway.ts?raw'
import paymentExceptionsSrc from '../lib/paymentExceptions.ts?raw'

const T = '2026-10-23T10:00:00Z'

function intentRow(orderNumber: string, over: Record<string, unknown> = {}) {
  return {
    id: `i-${orderNumber}-${Math.random().toString(36).slice(2, 8)}`,
    order_number: orderNumber,
    amount: 100,
    currency: 'thb',
    status: 'pending',
    method: 'promptpay_qr',
    provider: 'promptpay',
    metadata: {},
    created_at: T,
    updated_at: T,
    ...over,
  }
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('D-08 · เส้นอ่าน payment_intents = RPC เดียว (ตาราง REVOKE ตาม 034)', () => {
  it('getPaymentIntents({ orderNumbers }) ตอบจาก RPC ได้ครบและกรองถูก', async () => {
    await supabase.from('payment_intents').insert([
      intentRow('A1'), intentRow('A2'), intentRow('B1'),
    ])
    const rows = await getPaymentIntents({ orderNumbers: ['A1', 'B1'] })
    expect(rows.map((r) => r.order_number).sort()).toEqual(['A1', 'B1'])
  })

  it("source guarantee: paymentGateway ไม่มี from('payment_intents') และเรียก get_payment_intents_for_orders", () => {
    expect(paymentGatewaySrc).not.toContain("from('payment_intents')")
    expect(paymentGatewaySrc).toContain("rpc('get_payment_intents_for_orders'")
    // paymentExceptions ยังเป็น single-read-path ผ่าน getPaymentIntents (M5)
    expect(paymentExceptionsSrc).toContain('getPaymentIntents({ orderNumbers })')
    expect(paymentExceptionsSrc).not.toContain("from('payment_intents')")
  })
})

describe('D-08 · read failure ต้องไม่เงียบ (ห้ามคืน [])', () => {
  it('getPaymentIntents throw ERR_PAYMENT_INTENTS_READ เมื่อ RPC ล้ม', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for table payment_intents' },
    } as any)
    await expect(getPaymentIntents({ orderNumber: 'X1' })).rejects.toThrow(/ERR_PAYMENT_INTENTS_READ/)
  })

  it('getPaymentIntentsFor propagate error ออกไป (ไม่คืน [] ให้ UI เข้าใจผิด)', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for table payment_intents' },
    } as any)
    await expect(getPaymentIntentsFor(['X1'])).rejects.toThrow(/ERR_PAYMENT_INTENTS_READ/)
  })

  it('confirmPayment รายงาน ERR_PAYMENT_INTENTS_READ ไม่ใช่ "not found" ปลอม', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for table payment_intents' },
    } as any)
    const r = await confirmPayment('i-x', 'pm-x')
    expect(r.success).toBe(false)
    expect(String(r.error)).toContain('ERR_PAYMENT_INTENTS_READ')
  })
})

describe('D-08 · dedupe ฝั่ง server (migration 138) — ห้ามมี ACTIVE intent ที่สอง', () => {
  it('rpc create_payment_intent_record ซ้ำ → คืนแถวเดิม (idempotent)', async () => {
    await supabase.from('orders').insert([{
      id: 'o-1', order_number: 'BMB-R3-1', status: 'confirmed', payment_method: 'promptpay_qr',
      payment_status: 'pending', total_amount: 100, customer_ref: 'auth-test-user', created_at: T, updated_at: T,
    }])
    const first = await supabase.rpc('create_payment_intent_record', {
      p_order_number: 'BMB-R3-1', p_amount: 100, p_method: 'promptpay_qr', p_provider: 'promptpay', p_metadata: {},
    })
    const second = await supabase.rpc('create_payment_intent_record', {
      p_order_number: 'BMB-R3-1', p_amount: 100, p_method: 'promptpay_qr', p_provider: 'promptpay', p_metadata: {},
    })
    expect((first.data as any).idempotent).toBe(false)
    expect((second.data as any).idempotent).toBe(true)
    expect((second.data as any).id).toBe((first.data as any).id)
    const rows = await getPaymentIntents({ orderNumber: 'BMB-R3-1' })
    expect(rows).toHaveLength(1)
  })

  it('createPaymentIntent ซ้ำ → ไม่สร้างแถวใหม่ (client ยังคงพฤติกรรม R1.2)', async () => {
    await supabase.from('orders').insert([{
      id: 'o-2', order_number: 'BMB-R3-2', status: 'confirmed', payment_method: 'promptpay_qr',
      payment_status: 'pending', total_amount: 150, customer_ref: 'auth-test-user', created_at: T, updated_at: T,
    }])
    const a = await createPaymentIntent('BMB-R3-2', 150, 'promptpay_qr')
    const b = await createPaymentIntent('BMB-R3-2', 150, 'promptpay_qr')
    expect(a.success).toBe(true)
    expect(b.success).toBe(true)
    expect(b.payment_intent!.id).toBe(a.payment_intent!.id)
    const rows = await getPaymentIntents({ orderNumber: 'BMB-R3-2' })
    expect(rows).toHaveLength(1)
  })
})

describe('D-08 · confirm เลือกแถว processing ก่อน completed ใหม่กว่า (841/205 trap)', () => {
  it('คู่ซ้ำ processing(เก่า) + completed(ใหม่) → ยืนยันสำเร็จและปิดแถว processing', async () => {
    await supabase.from('orders').insert([{
      id: 'o-3', order_number: 'BMB-R3-3', status: 'confirmed', payment_method: 'promptpay_qr',
      payment_status: 'pending', total_amount: 200, customer_ref: 'auth-test-user', created_at: T, updated_at: T,
    }])
    await supabase.from('payment_intents').insert([
      intentRow('BMB-R3-3', { id: 'i-proc', status: 'processing', amount: 200, created_at: '2026-10-23T09:59:58Z' }),
      intentRow('BMB-R3-3', { id: 'i-done', status: 'completed', amount: 200, created_at: '2026-10-23T10:00:00Z' }),
    ])
    const r = await supabase.rpc('confirm_offline_payment', { p_order_number: 'BMB-R3-3' })
    expect(r.error).toBeNull()
    expect((r.data as any).ok).toBe(true)
    const rows = await getPaymentIntents({ orderNumber: 'BMB-R3-3' })
    expect(rows.find((x) => x.id === 'i-proc')!.status).toBe('completed')
  })
})