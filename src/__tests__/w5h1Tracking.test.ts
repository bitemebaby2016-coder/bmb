// ============================================
// W5-1 — H1 security patch tests (migration 050 contract)
// ============================================
// Proves the CLIENT contract of the secure guest-tracking read path:
//  - track_order returns tracking-scope fields ONLY (no PII leakage)
//  - wrong number / wrong phone / nonexistent → identical not-found shape
//  - phone normalization (dashes/spaces) matches
// NOTE: RLS behavior (anon cannot SELECT orders) is enforced server-side and
// verified against production via e2e/w5h1-probes (see BMB_W5_H1_SECURITY_PATCH.md).
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockRef, mockTables } from './helpers/mockRef'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  const m = createSupabaseMock()
  mockRef.current = m
  return { supabase: m, supabaseAdmin: null, default: null }
})

import { trackOrderByPhone } from '@/lib/trackingApi'

const TEST_ORDER = {
  id: 'qa-w5h1-order',
  order_number: 'QA-W5H1-001',
  customer_id: 'qa-cust',
  customer_ref: 'auth-test-user',
  customer_name: 'QA Tester',
  customer_phone: '0800000001',
  delivery_round_id: 'round-1',
  status: 'delivered',
  order_mode: 'SAME_DAY',
  delivery_method: 'self_delivery',
  dropoff_detail: 'SECRET ADDRESS — MUST NOT LEAK',
  dropoff_latitude: 12.123,
  dropoff_longitude: 102.456,
  total_amount: 65,
  payment_status: 'paid',
  created_at: new Date().toISOString(),
}

const TEST_ITEM = {
  id: 'qa-w5h1-item',
  order_id: 'qa-w5h1-order',
  product_id: 'prod-1',
  product_name: 'QA dish',
  quantity: 1,
  unit_price: 65,
  created_at: new Date().toISOString(),
}

const TEST_INTENT = {
  id: 'qa-w5h1-intent',
  order_number: 'QA-W5H1-001',
  status: 'completed',
  receipt_url: 'https://example.test/receipt.pdf',
  created_at: new Date().toISOString(),
}

describe('W5-1 secure guest tracking (track_order RPC contract)', () => {
  beforeEach(() => {
    mockRef.current?.__reset?.()
    const t = mockTables()
    t['orders'] = [{ ...TEST_ORDER }]
    t['order_items'] = [{ ...TEST_ITEM }]
    t['payment_intents'] = [{ ...TEST_INTENT }]
    try { localStorage.removeItem('bmb_track_phone') } catch { /* ignore */ }
  })

  it('happy path: correct order_number + phone → tracking fields only', async () => {
    const o = await trackOrderByPhone('QA-W5H1-001', '0800000001')
    expect(o).not.toBeNull()
    expect(o!.order_number).toBe('QA-W5H1-001')
    expect(o!.status).toBe('delivered')
    expect(o!.payment_status).toBe('paid')
    expect(o!.total_amount).toBe(65)
    expect(o!.items).toHaveLength(1)
    expect((o as any).receipt_url).toBe('https://example.test/receipt.pdf')
    // PII / sensitive / internal fields MUST NOT be present
    const banned = ['customer_name', 'customer_phone', 'customer_id', 'customer_ref',
      'dropoff_detail', 'dropoff_latitude', 'dropoff_longitude',
      'delivery_address', 'payment_intent_id', 'special_instructions']
    const keys = Object.keys(o as any)
    for (const b of banned) expect(keys).not.toContain(b)
  })

  it('wrong phone → same not-found shape as nonexistent order', async () => {
    const wrongPhone = await trackOrderByPhone('QA-W5H1-001', '0999999999')
    const nonexistent = await trackOrderByPhone('QA-DOES-NOT-EXIST', '0800000001')
    expect(wrongPhone).toBeNull()
    expect(nonexistent).toBeNull()
  })

  it('wrong order number → not found', async () => {
    expect(await trackOrderByPhone('QA-W5H1-999', '0800000001')).toBeNull()
  })

  it('phone format drift (dashes/spaces) still matches', async () => {
    const o = await trackOrderByPhone('QA-W5H1-001', '080-000-0001')
    expect(o).not.toBeNull()
    expect(o!.order_number).toBe('QA-W5H1-001')
  })

  it('missing phone or number → refused client-side (no order_number-only path)', async () => {
    expect(await trackOrderByPhone('QA-W5H1-001', '')).toBeNull()
    expect(await trackOrderByPhone('', '0800000001')).toBeNull()
  })
})
