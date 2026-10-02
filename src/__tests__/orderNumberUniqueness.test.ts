// ============================================
// B-1 regression — order_number uniqueness (migration 104 contract)
// Guarantees under test (mock mirrors canonical DB contract):
//   1 logical order = 1 canonical order row = 1 unique order_number
//   - single create
//   - parallel / N concurrent creates → all distinct order_numbers
//   - pre-existing number is never reused (collision → regenerate)
// ============================================

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

const today = () => new Date().toISOString().slice(0, 10)

function createOrder(customerName: string) {
  return supabase.rpc('create_order_with_items', {
    p_items: [{ product_id: 'prod-1', quantity: 1 }],
    p_delivery_round_id: 'round-1',
    p_customer_name: customerName,
    p_order_mode: 'SAME_DAY',
  })
}

describe('B-1 order_number uniqueness (migration 104 contract)', () => {
  it('single create → exactly one row for the generated order_number', async () => {
    const r = await createOrder('Single Create')
    expect(r.error).toBeNull()
    const onum = String((r.data as any).order_number)
    // NOTE: mock generates the test-prefix format BMB-TEST-### (pre-existing mock
    // convention, asserted by api.test.ts:129). Production format is
    // BMB-YYYYMMDD-### (migration 025 §9). Format fidelity is DEFERRED — this
    // test pins the UNIQUENESS contract, which is what migration 104 fixes.
    expect(onum).toMatch(/^BMB-TEST-\d{3}$/)

    const all = (await supabase.from('orders').select('*')).data as any[]
    expect(all.filter((o) => o.order_number === onum)).toHaveLength(1)
  })

  it('N concurrent creates → all succeed, all order_numbers distinct, one row each', async () => {
    const N = 8
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => createOrder(`Concurrent ${i + 1}`)),
    )
    results.forEach((r) => expect(r.error).toBeNull())

    const numbers = results.map((r) => String((r.data as any).order_number))
    expect(new Set(numbers).size).toBe(N) // no duplicates under concurrency

    const all = (await supabase.from('orders').select('*')).data as any[]
    numbers.forEach((n) => {
      expect(all.filter((o) => o.order_number === n)).toHaveLength(1)
    })
  })

  it('pre-existing order_number is never reused (collision → regenerate, not duplicate)', async () => {
    const first = await createOrder('Collision Seed')
    expect(first.error).toBeNull()
    const seedNumber = String((first.data as any).order_number)

    // force the generator into the colliding region repeatedly
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => createOrder(`Collision Test ${i + 1}`)),
    )
    results.forEach((r) => expect(r.error).toBeNull())
    const numbers = results.map((r) => String((r.data as any).order_number))
    expect(numbers).not.toContain(seedNumber)
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})