// ============================================
// Bite Me Baby — Pickup routing + daily-sales CSV unit tests
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => {
  const rpc = vi.fn(async () => ({ data: { order_number: 'BMB-1', status: 'pending', payment_status: 'pending', total_amount: 100, pickup_code: '555555' }, error: null }))
  const from = vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  }))
  return { supabase: { rpc, from } }
})

import { supabase } from '@/lib/supabase'
import { createOrder, orderInputFingerprint, OrderInput } from '@/lib/bmbAdminApi_orders'
import { buildDailySalesCsv, DAILY_SALES_CSV_LABELS, DailySales } from '@/lib/posApi'

const baseInput: OrderInput = {
  items: [{ product_id: 'p1', quantity: 1 }],
  delivery_round_id: 'round-1',
  customer_name: 'ทดสอบ',
  payment_method: 'cash_on_delivery',
}

describe('createOrder routing (127 pickup)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('routes delivery_method=pickup to create_pickup_order_i', async () => {
    await createOrder({ ...baseInput, delivery_method: 'pickup' })
    const calls = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][0]).toBe('create_pickup_order_i')
  })

  it('routes delivery orders to the canonical create_order_with_items_i', async () => {
    await createOrder({ ...baseInput, delivery_method: 'self_delivery', dropoff_latitude: 1, dropoff_longitude: 2 })
    const calls = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][0]).toBe('create_order_with_items_i')
    expect(calls[0][1]).toMatchObject({ p_delivery_method: 'self_delivery' })
  })

  it('pickup fingerprint differs from delivery fingerprint', () => {
    const f1 = orderInputFingerprint({ ...baseInput, delivery_method: 'pickup' })
    const f2 = orderInputFingerprint({ ...baseInput, delivery_method: 'self_delivery' })
    expect(f1).not.toBe(f2)
  })

  it('fingerprint is stable for identical payloads and channel-aware', () => {
    const f1 = orderInputFingerprint({ ...baseInput, source_channel: 'POS' })
    const f2 = orderInputFingerprint({ ...baseInput, source_channel: 'POS' })
    const f3 = orderInputFingerprint({ ...baseInput, source_channel: 'WEB' })
    expect(f1).toBe(f2)
    expect(f1).not.toBe(f3)
  })
})

describe('daily sales CSV export', () => {
  const row: DailySales = {
    date: '2026-10-19',
    orders_count: 3,
    cancelled_count: 0,
    gross_sales: 300,
    discount_total: 10,
    delivery_fee_total: 25,
    tax_total: 0,
    net_sales: 315,
    paid_amount: 200,
    unpaid_amount: 115,
    refunded_amount: 0,
    paid_by_cash: 200,
    paid_by_promptpay: 0,
    paid_by_card: 0,
    sameday_count: 3,
    preorder_count: 0,
    pickup_count: 1,
    pickup_paid_amount: 100,
  }

  it('emits UTF-8 BOM + Thai header + one row', () => {
    const csv = buildDailySalesCsv([row])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('วันที่')
    expect(csv).toContain('ชำระแล้ว-เงินสด')
    expect(csv.split('\n').filter((l) => l.trim().length > 0)).toHaveLength(2)
  })

  it('covers every DailySales key in the header', () => {
    const csv = buildDailySalesCsv([row])
    const header = csv.replace('\uFEFF', '').split('\n')[0]
    const cols = header.split(',')
    expect(cols).toHaveLength(Object.keys(DAILY_SALES_CSV_LABELS).length)
  })
})