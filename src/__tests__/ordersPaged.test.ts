// ============================================
// Bite Me Baby — getOrdersPaged / read-helper contract tests (W4-E-1 · D9)
// ============================================
// These tests verify the API layer's READ CONTRACT (page→range math, status→eq
// filter, count handling, ordering, graceful degradation) against the in-memory
// Supabase mock, which mirrors real PostgREST semantics (filter/sort/range/count).
// Live production behavior of the same query patterns is verified separately
// (read-only probes — see BMB_W4E1_READ_PATH_HARDENING.md).

import { describe, it, expect, vi } from 'vitest'

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
import {
  getOrdersPaged,
  getOrdersAggregated,
  getOrdersByStatuses,
  getOrdersByCustomer,
  getOrdersSince,
} from '@/lib/bmbAdminApi_orders'

const OWNED = 7
// deterministic seed: owned orders i=0..6 (oldest→newest), statuses varied,
// plus one 'other' customer row placed OLDEST so paged slices start with owned.
const SEED = [
  ...Array.from({ length: OWNED }, (_, i) => ({
    id: `ord-owned-${i}`,
    order_number: `BMB-T-${i + 1}`,
    customer_id: 'auth-test-user',
    customer_name: `Tester ${i}`,
    status: (['pending', 'confirmed', 'pending', 'delivered', 'pending', 'delivered', 'delivered'] as const)[i],
    payment_status: 'pending',
    total_amount: (i + 1) * 10,
    delivery_round_id: 'round-1',
    delivery_method: 'self_delivery',
    items: [],
    created_at: `2026-09-15T10:${String(10 + i).padStart(2, '0')}:00Z`,
    updated_at: `2026-09-15T10:${String(10 + i).padStart(2, '0')}:00Z`,
  })),
  {
    id: 'ord-other-1',
    order_number: 'BMB-T-OTHER',
    customer_id: 'someone-else',
    customer_name: 'Other',
    status: 'pending',
    payment_status: 'pending',
    total_amount: 999,
    delivery_round_id: 'round-1',
    delivery_method: 'self_delivery',
    items: [],
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
]

async function seedOrders() {
  const existing = await supabase.from('orders').select('id')
  if ((existing.data as any[])?.length) return
  await supabase.from('orders').insert(SEED as any)
}

describe('getOrdersPaged contract (W4-E-1 D9)', () => {
  it('default page/pageSize returns everything with exact count', async () => {
    await seedOrders()
    const res = await getOrdersPaged({ page: 0 })
    expect(res.orders.length).toBe(8)
    expect(res.total).toBe(8)
  })

  it('explicit page/pageSize slices correctly (range math)', async () => {
    await seedOrders()
    const res = await getOrdersPaged({ page: 1, pageSize: 3 })
    expect(res.orders.length).toBe(3)
    expect(res.total).toBe(8)
    // desc order: 7,6,5,4,3,2,1,OTHER → page1(size3) = rows 4..6
    expect(res.orders.map(o => o.order_number)).toEqual(['BMB-T-4', 'BMB-T-3', 'BMB-T-2'])
  })

  it('status filter narrows both rows and count', async () => {
    await seedOrders()
    const res = await getOrdersPaged({ page: 0, status: 'pending' })
    expect(res.total).toBe(4)
    expect(res.orders.every(o => o.status === 'pending')).toBe(true)
    expect(res.orders.length).toBe(4)
  })

  it('count is exact regardless of page window', async () => {
    await seedOrders()
    const p0 = await getOrdersPaged({ page: 0, pageSize: 3 })
    const p2 = await getOrdersPaged({ page: 2, pageSize: 3 })
    expect(p0.total).toBe(8)
    expect(p2.total).toBe(8)
    expect(p2.orders.length).toBe(2)
  })

  it('empty page returns [] but keeps total', async () => {
    await seedOrders()
    const res = await getOrdersPaged({ page: 10, pageSize: 25 })
    expect(res.orders).toEqual([])
    expect(res.total).toBe(8)
  })

  it('ordering is stable (created_at desc) across calls', async () => {
    await seedOrders()
    const a = await getOrdersPaged({ page: 0, pageSize: 5 })
    const b = await getOrdersPaged({ page: 0, pageSize: 5 })
    expect(a.orders.map(o => o.order_number)).toEqual(b.orders.map(o => o.order_number))
    const times = a.orders.map(o => o.created_at)
    expect([...times].sort().reverse()).toEqual(times)
  })

  it('errors degrade gracefully to empty result (contract)', async () => {
    // simulate a PostgREST error response through the full builder chain —
    // the API layer must degrade to the documented empty-result contract
    const errBuilder: any = {
      select() { return errBuilder },
      eq() { return errBuilder },
      order() { return errBuilder },
      range() { return errBuilder },
      then(res: (v: any) => void) { res({ data: null, error: { code: 'PGRST', message: 'forced' }, count: null }) },
    }
    const spy = vi.spyOn(supabase, 'from') as any
    spy.mockImplementationOnce(() => errBuilder)
    const res = await getOrdersPaged({ page: 0 })
    expect(res).toEqual({ orders: [], total: 0 })
    spy.mockImplementationOnce(() => errBuilder)
    const agg = await getOrdersAggregated()
    expect(agg).toEqual({ total: 0, totalRevenue: 0 })
    spy.mockRestore()
  })
})

describe('aggregated / filtered read helpers (W4-E-1 D1 contract)', () => {
  it('getOrdersAggregated sums totals without row objects', async () => {
    await seedOrders()
    const agg = await getOrdersAggregated()
    expect(agg.total).toBe(8)
    expect(agg.totalRevenue).toBe(999 + 10 + 20 + 30 + 40 + 50 + 60 + 70)
  })

  it('getOrdersByStatuses filters server-side', async () => {
    await seedOrders()
    const rows = await getOrdersByStatuses(['pending'])
    expect(rows.length).toBe(4)
    expect(rows.every(o => o.status === 'pending')).toBe(true)
  })

  it('getOrdersByCustomer filters to one customer', async () => {
    await seedOrders()
    const rows = await getOrdersByCustomer('auth-test-user')
    expect(rows.length).toBe(OWNED)
    expect(rows.every(o => o.customer_id === 'auth-test-user')).toBe(true)
  })

  it('getOrdersSince bounds by created_at (gte)', async () => {
    await seedOrders()
    const rows = await getOrdersSince({ sinceISO: '2026-09-15T10:00:00Z' })
    expect(rows.length).toBe(OWNED)
    const recent = await getOrdersSince({ sinceISO: '2026-09-15T10:16:00Z' })
    expect(recent.length).toBe(1)
  })
})
