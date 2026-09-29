// ============================================
// Bite Me Baby — STEP 3B-2B Pre-order queue tests
// ============================================
// Covers: PRE_ORDER vs SAME_DAY display · scheduled_date/round grouping ·
// capacity + cutoff DISPLAY from the DB source of truth (delivery_rounds —
// the client never enforces; server 025/038 remain authority) · payment
// exception classification · canonical-only actions · read-only round reads.

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
import {
  groupPreOrders, roundCapacityState, roundCutoffState, isPaymentException,
} from '@/lib/preOrderQueue'
import { canAdminTransition } from '@/lib/adminOrderDisplay'
import { getOrdersPaged, getRoundsByIds } from '@/lib/bmbAdminApi_orders'

const ROW = {
  id: '', order_number: '', customer_id: 'auth-test-user', customer_name: 'T', customer_phone: '0',
  status: 'pending', payment_status: 'pending', total_amount: 10, delivery_round_id: 'round-1',
  delivery_method: 'self_delivery', items: [], created_at: '', updated_at: '',
  delivery_fee: 0, payment_method: 'promptpay_qr', delivery_address: '', dropoff_latitude: 0, dropoff_longitude: 0,
  order_mode: undefined as 'SAME_DAY' | 'PRE_ORDER' | undefined, scheduled_date: undefined as string | undefined,
}

function po(over: Partial<typeof ROW> & { order_number: string }) {
  return { ...ROW, ...over }
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
})

describe('3B-2B · queue grouping by scheduled_date + round (canonical spine columns)', () => {
  it('groups PRE_ORDER orders by (scheduled_date, delivery_round_id)', () => {
    const groups = groupPreOrders([
      po({ order_number: 'A', scheduled_date: '2026-10-02', delivery_round_id: 'r-morning' }),
      po({ order_number: 'B', scheduled_date: '2026-10-02', delivery_round_id: 'r-morning' }),
      po({ order_number: 'C', scheduled_date: '2026-10-02', delivery_round_id: 'r-evening' }),
      po({ order_number: 'D', scheduled_date: '2026-10-05', delivery_round_id: 'r-morning' }),
    ])
    expect(groups.map((g) => g.key)).toEqual(['2026-10-05|r-morning', '2026-10-02|r-evening', '2026-10-02|r-morning'])
    expect(groups[2].orders.map((o) => o.order_number)).toEqual(['A', 'B'])
  })
  it('missing scheduled_date/round degrades to a visible "—" group (never silently dropped)', () => {
    const groups = groupPreOrders([po({ order_number: 'X', scheduled_date: undefined, delivery_round_id: undefined })])
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('—|—')
  })
  it('SAME_DAY orders are NOT mixed into the pre-order queue view', async () => {
    const t = new Date().toISOString()
    await supabase.from('orders').insert([
      { ...ROW, id: 'o-sd', order_number: 'SD-1', order_mode: 'SAME_DAY', scheduled_date: '2026-10-02', created_at: t, updated_at: t },
      { ...ROW, id: 'o-po', order_number: 'PO-1', order_mode: 'PRE_ORDER', scheduled_date: '2026-10-05', created_at: t, updated_at: t },
    ] as any)
    const po1 = await getOrdersPaged({ page: 0, orderMode: 'PRE_ORDER' })
    expect(po1.orders.map((o) => o.order_number)).toEqual(['PO-1'])
    const groups = groupPreOrders(po1.orders)
    expect(groups).toHaveLength(1)
    expect(groups[0].scheduledDate).toBe('2026-10-05')
  })
})


describe('3B-2B · capacity display — from DB source of truth, no client authority', () => {
  const round = { id: 'r1', max_capacity: 60, current_count: 44, cutoff_time: '08:00', delivery_start: '07:00', delivery_end: '10:00', status: 'active' }
  it('shows slots from delivery_rounds row', () => {
    const s = roundCapacityState(round as any, 3)
    expect(s.used).toBe(44)
    expect(s.max).toBe(60)
    expect(s.remaining).toBe(16)
    expect(s.full).toBe(false)
    expect(s.label).toContain('44/60')
  })
  it('full round flags FULL (server still rejects with ERR_CAPACITY_FULL)', () => {
    const s = roundCapacityState({ ...round, current_count: 60 } as any, 0)
    expect(s.full).toBe(true)
    expect(s.cls).toBe('badge-danger')
  })
  it('missing round row is flagged, never fabricated', () => {
    const s = roundCapacityState(null, 7)
    expect(s.used).toBeNull()
    expect(s.label).toContain('round?')
  })
})

describe('3B-2B · cutoff display — raw DB values only (038 server enforces the 2h rule)', () => {
  it('shows cutoff/delivery window from the round row', () => {
    const s = roundCutoffState({ id: 'r1', cutoff_time: '16:00:00', delivery_start: '18:00:00', delivery_end: '20:00:00' } as any)
    expect(s.unknown).toBe(false)
    expect(s.label).toContain('cutoff 16:00')
    expect(s.label).toContain('delivery 18:00–20:00')
  })
  it('missing cutoff is surfaced as unknown (server: ERR_PRE_ORDER_CUTOFF_UNKNOWN)', () => {
    expect(roundCutoffState(null).unknown).toBe(true)
    expect(roundCutoffState({ id: 'r2' } as any).label).toContain('cutoff unknown')
  })
})

describe('3B-2B · payment exception classification on the queue', () => {
  it('pending/processing/failed/refund/partially_refunded/refunded need attention', () => {
    for (const s of ['pending', 'processing', 'failed', 'refund', 'partially_refunded', 'refunded']) {
      expect(isPaymentException(s)).toBe(true)
    }
  })
  it('paid does not need attention', () => {
    expect(isPaymentException('paid')).toBe(false)
    expect(isPaymentException(null)).toBe(false)
  })
})

describe('3B-2B · actions stay canonical (no new transitions in the queue UI)', () => {
  it('PRE_ORDER uses the same canonical machine: legal hop allowed, illegal blocked', () => {
    expect(canAdminTransition('pending', 'confirmed')).toBe(true)
    expect(canAdminTransition('ready_for_dispatch', 'delivered')).toBe(false)
    expect(canAdminTransition('delivered', 'cancelled')).toBe(false)
  })
})

describe('3B-2B · round reads are READ-ONLY and degrade gracefully', () => {
  it('getRoundsByIds reads seeded delivery_rounds and never mutates', async () => {
    const seeded = await supabase.from('delivery_rounds').select('id')
    const ids = (seeded.data as any[]).map((r) => r.id)
    const rounds = await getRoundsByIds(ids)
    expect(rounds.length).toBe(ids.length)
    const after = await supabase.from('delivery_rounds').select('id')
    expect((after.data as any[]).length).toBe(ids.length)
  })
  it('empty/unknown ids degrade to [] without throwing', async () => {
    await expect(getRoundsByIds([])).resolves.toEqual([])
    await expect(getRoundsByIds(['round-nope'])).resolves.toEqual([])
  })
})
