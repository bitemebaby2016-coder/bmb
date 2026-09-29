// ============================================
// Bite Me Baby — STEP 3B-2A Admin Orders operational control tests
// ============================================
// Covers: SAME_DAY/PRE_ORDER display · payment states · delivery states ·
// canonical transition allow-list (valid/invalid) · atomic cancel via
// cancel_order RPC · order_mode server-side filter · graceful degrade of the
// read-model helpers. The SERVER (008 allow-list + transition_order_status RPC)
// remains the sole transition authority — these tests verify the DISPLAY mirror
// matches it and that client actions only ever call canonical paths.
// NOTE: no real-money paths, no real customers — offline mock only.

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
  canAdminTransition, nextForwardAction, isCancellable,
  orderModeBadge, paymentStateBadge, deliveryStateBadge,
  ADMIN_ALLOWED_TRANSITIONS, PAYMENT_STATES, DELIVERY_STATES,
} from '@/lib/adminOrderDisplay'
import {
  getOrdersPaged, updateOrderStatus, cancelOrder,
  getOrderStatusHistory, getDeliveryAssignmentsFor, getOrderAuditTrail,
} from '@/lib/bmbAdminApi_orders'

const ROW = {
  id: '', order_number: '', customer_id: 'auth-test-user', customer_ref: 'auth-test-user',
  customer_name: 'T', customer_phone: '0',
  status: 'pending', payment_status: 'pending', total_amount: 10, delivery_round_id: 'round-1',
  delivery_method: 'self_delivery', items: [], created_at: '', updated_at: '',
  order_mode: undefined as string | undefined, scheduled_date: undefined as string | undefined,
}

function orderRow(over: Partial<typeof ROW> & { order_number: string; created_at: string }) {
  return { ...ROW, ...over }
}

async function seedOrders() {
  // fresh timestamps: the mock cancel_order enforces the D-5 (5-minute) window
  const t1 = new Date(Date.now() - 60_000).toISOString()
  const t2 = new Date(Date.now() - 30_000).toISOString()
  await supabase.from('orders').insert([
    orderRow({ id: 'o-sd', order_number: 'BMB-SD-1', created_at: t1, updated_at: t1, order_mode: 'SAME_DAY', status: 'pending' }),
    orderRow({ id: 'o-po', order_number: 'BMB-PO-1', created_at: t2, updated_at: t2, order_mode: 'PRE_ORDER', scheduled_date: '2026-10-05', status: 'confirmed' }),
  ] as any)
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
})

describe('3B-2A · SAME_DAY / PRE_ORDER display (Phase D boundary: display only)', () => {
  it('SAME_DAY renders as same-day badge without a scheduled date', () => {
    const b = orderModeBadge('SAME_DAY', '2026-10-05')
    expect(b.mode).toBe('SAME_DAY')
    expect(b.label).toContain('SAME_DAY')
    expect(b.label).not.toContain('2026-10-05')
  })
  it('PRE_ORDER renders with its scheduled_date', () => {
    const b = orderModeBadge('PRE_ORDER', '2026-10-05')
    expect(b.mode).toBe('PRE_ORDER')
    expect(b.label).toContain('PRE_ORDER')
    expect(b.label).toContain('2026-10-05')
  })
  it('unknown mode is flagged, never silently shown as SAME_DAY', () => {
    expect(orderModeBadge(undefined).mode).toBe('UNKNOWN')
    expect(orderModeBadge(null, null).label).toContain('mode?')
  })
  it('getOrdersPaged orderMode filter is server-side and distinguishes modes', async () => {
    await seedOrders()
    const sd = await getOrdersPaged({ page: 0, orderMode: 'SAME_DAY' })
    expect(sd.orders.map((o) => o.order_number)).toEqual(['BMB-SD-1'])
    const po = await getOrdersPaged({ page: 0, orderMode: 'PRE_ORDER' })
    expect(po.orders.map((o) => o.order_number)).toEqual(['BMB-PO-1'])
    expect(po.orders[0].scheduled_date).toBe('2026-10-05')
  })
})

describe('3B-2A · payment state display', () => {
  it('every canonical payment state has a badge', () => {
    for (const s of PAYMENT_STATES) {
      const b = paymentStateBadge(s)
      expect(b.label.length).toBeGreaterThan(0)
      expect(b.cls).toMatch(/^badge-/)
    }
  })
  it('covers the STEP-2 exception states (processing / partially_refunded / refunded / failed)', () => {
    expect(paymentStateBadge('processing').label).toContain('processing')
    expect(paymentStateBadge('partially_refunded').label).toContain('partially_refunded')
    expect(paymentStateBadge('refunded').label).toContain('refunded')
    expect(paymentStateBadge('failed').cls).toBe('badge-danger')
    expect(paymentStateBadge('paid').cls).toBe('badge-success')
  })
  it('missing/unknown payment status does not crash the card', () => {
    expect(paymentStateBadge(null).label).toContain('no payment')
    expect(paymentStateBadge('weird').label).toBe('weird')
  })
})

describe('3B-2A · delivery (assignment) state display', () => {
  it('no assignment row → unassigned', () => {
    expect(deliveryStateBadge(null).label).toContain('unassigned')
    expect(deliveryStateBadge(undefined).label).toContain('unassigned')
  })
  it('canonical 020 assignment statuses pass through', () => {
    for (const s of ['assigned', 'accepted', 'picked_up', 'in_transit', 'delivered']) {
      expect((DELIVERY_STATES as readonly string[]).includes(s)).toBe(true)
      expect(deliveryStateBadge({ status: s }).label.length).toBeGreaterThan(0)
    }
    expect(deliveryStateBadge({ status: 'delivered' }).cls).toBe('badge-success')
  })
  it('cancelled assignment surfaces as exception (admin follow-up required)', () => {
    expect(deliveryStateBadge({ status: 'cancelled' }).label).toContain('exception')
    expect(deliveryStateBadge({ status: 'garbage' }).label).toContain('exception')
  })
})


describe('3B-2A · canonical transition allow-list (mirror of 008 — display only)', () => {
  it('every forward hop of the 008 chain is allowed', () => {
    const chain = ['pending', 'confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived', 'delivered']
    for (let i = 0; i < chain.length - 1; i++) {
      expect(canAdminTransition(chain[i], chain[i + 1])).toBe(true)
    }
  })
  it('GAP-A1 regression: ready_for_dispatch must go to dispatched, NEVER straight to delivered', () => {
    expect(canAdminTransition('ready_for_dispatch', 'dispatched')).toBe(true)
    expect(canAdminTransition('ready_for_dispatch', 'delivered')).toBe(false)
    expect(nextForwardAction('ready_for_dispatch')!.to).toBe('dispatched')
  })
  it('illegal jumps/skips/backward are blocked by the mirror (and would be by the RPC)', () => {
    expect(canAdminTransition('pending', 'delivered')).toBe(false)
    expect(canAdminTransition('pending', 'preparing')).toBe(false)
    expect(canAdminTransition('delivered', 'confirmed')).toBe(false)
    expect(canAdminTransition('cancelled', 'pending')).toBe(false)
    expect(canAdminTransition('confirmed', 'dispatched')).toBe(false)
  })
  it('terminal states expose no forward action and are not cancellable', () => {
    for (const t of ['delivered', 'cancelled', 'failed']) {
      expect(nextForwardAction(t)).toBeNull()
      expect(isCancellable(t)).toBe(false)
      expect(ADMIN_ALLOWED_TRANSITIONS[t]).toEqual([])
    }
  })
  it('cancellation is canonical from every non-terminal state', () => {
    for (const s of ['pending', 'confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived']) {
      expect(isCancellable(s)).toBe(true)
    }
  })
})

describe('3B-2A · client actions stay on canonical authority (mock RPC contract)', () => {
  it('valid transition goes through transition_order_status RPC', async () => {
    await seedOrders()
    const updated = await updateOrderStatus('BMB-SD-1', 'confirmed')
    expect(updated).toBeTruthy()
  })
  it('invalid transition is blocked (RPC error → null, no client mutation)', async () => {
    await seedOrders()
    const updated = await updateOrderStatus('BMB-SD-1', 'delivered')
    expect(updated).toBeNull()
    const fresh = await getOrdersPaged({ page: 0, status: 'pending' })
    expect(fresh.orders.some((o) => o.order_number === 'BMB-SD-1')).toBe(true)
  })
  it('admin cancel uses the atomic cancel_order RPC (capacity + inventory in one result)', async () => {
    await seedOrders()
    const r = await cancelOrder('BMB-SD-1', 'operator test cancel')
    expect(r.success).toBe(true)
    expect(r.previous_status).toBe('pending')
    expect(r.capacity_released).toBe(true)
    expect(typeof r.inventory_restored).toBe('boolean')
  })
})

describe('3B-2A · read-model helpers degrade gracefully (RLS-scoped reads)', () => {
  it('order_status_history / delivery_assignments / audit reads never throw offline', async () => {
    await expect(getOrderStatusHistory('BMB-NOPE')).resolves.toEqual([])
    await expect(getDeliveryAssignmentsFor([])).resolves.toEqual([])
    await expect(getDeliveryAssignmentsFor(['BMB-SD-1'])).resolves.toEqual([])
    await expect(getOrderAuditTrail('BMB-NOPE')).resolves.toEqual([])
  })
  it('forced transport error degrades to [] (no crash on Admin Orders)', async () => {
    const errBuilder: any = {
      select() { return errBuilder },
      eq() { return errBuilder },
      in() { return errBuilder },
      order() { return errBuilder },
      limit() { return errBuilder },
      then(res: (v: any) => void) { res({ data: null, error: { code: 'PGRST', message: 'forced' } }) },
    }
    const spy = vi.spyOn(supabase, 'from') as any
    spy.mockImplementation(() => errBuilder)
    await expect(getOrderStatusHistory('X')).resolves.toEqual([])
    await expect(getDeliveryAssignmentsFor(['X'])).resolves.toEqual([])
    await expect(getOrderAuditTrail('X')).resolves.toEqual([])
    spy.mockRestore()
  })
})
