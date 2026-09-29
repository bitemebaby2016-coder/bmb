// ============================================
// Bite Me Baby — STEP 3B-2D Dispatch/Driver contract tests
// ============================================
// Covers the Owner §11 matrix against the CANONICAL driver/dispatch paths
// (migrations 020/036/037/041 as mirrored by the mock): assign_driver admin
// gating + deterministic reassignment + dispatchability; JWT-bound driver
// identity (accept/status/my_deliveries); forward-only delivery sync along the
// canonical spine; terminal states blocked. Regression: kitchen spine (3B-2C),
// pre-order queue (3B-2B), admin allow-list (3B-2A) untouched.
// NOTE: offline mock only — no real riders, no real deliveries.

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
import { adminListDrivers, assignDriver, driverLogin, myDeliveries, driverAcceptAssignment, driverUpdateDeliveryStatus, linkDriverUser, upsertDriver } from '@/lib/driverService'
import { updateOrderStatus } from '@/lib/bmbAdminApi_orders'
import { ADMIN_ALLOWED_TRANSITIONS } from '@/lib/adminOrderDisplay'

const ORDER_ROW = {
  id: '', order_number: '', customer_id: 'auth-test-user', customer_ref: 'auth-test-user',
  customer_name: 'T', customer_phone: '0',
  status: 'ready_for_dispatch', payment_status: 'paid', payment_method: 'credit_card',
  total_amount: 10, delivery_fee: 0, delivery_address: 'ทดสอบ', dropoff_latitude: 10, dropoff_longitude: 102,
  delivery_round_id: 'round-1', delivery_method: 'self_delivery',
  items: [] as any[], created_at: '', updated_at: '',
  order_mode: 'SAME_DAY',
}

async function seedOrder(over: Partial<typeof ORDER_ROW> & { order_number: string }) {
  const t = new Date().toISOString()
  await supabase.from('orders').insert([{ ...ORDER_ROW, ...over, created_at: t, updated_at: t, id: over.id || 'o-' + over.order_number }] as any)
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
  ;(supabase as any).__setNoAdmin?.(false)
})

// ---------------------------------------------------------------------------
// §11 — READY_FOR_DISPATCH → assign valid driver / denied cases
// ---------------------------------------------------------------------------
describe('3B-2D · assign_driver contract (admin authority, 020)', () => {
  it('ready_for_dispatch → assign valid driver succeeds (canonical RPC)', async () => {
    await seedOrder({ order_number: 'D-OK' })
    await upsertDriver('QA Rider', '0900000001', 'bike')
    const ok = await assignDriver('D-OK', (await adminListDrivers()).drivers[0].id)
    expect(ok).toBe(true)
    const asg = (supabase as any).__tables.delivery_assignments as any[]
    expect(asg).toHaveLength(1)
    expect(asg[0]).toMatchObject({ order_number: 'D-OK', status: 'assigned' })
  })
  it('invalid driver → denied (ERR_DRIVER_NOT_FOUND)', async () => {
    await seedOrder({ order_number: 'D-BADDRV' })
    const ok = await assignDriver('D-BADDRV', 'drv-does-not-exist')
    expect(ok).toBe(false)
  })
  it('unauthorized (non-admin) assignment → denied', async () => {
    ;(supabase as any).__setNoAdmin?.(true)
    await seedOrder({ order_number: 'D-NOAUTH' })
    await upsertDriver('QA Rider', '0900000001', 'bike')
    const ok = await assignDriver('D-NOAUTH', (await adminListDrivers()).drivers[0]?.id || 'drv-x')
    expect(ok).toBe(false)
    ;(supabase as any).__setNoAdmin?.(false)
  })
  it('duplicate assignment → deterministic (single row per order; reassign resets)', async () => {
    await seedOrder({ order_number: 'D-DUP' })
    await upsertDriver('Rider A', '0900000001', 'bike')
    await upsertDriver('Rider B', '0900000002', 'bike')
    const ids = (await adminListDrivers()).drivers.map((d) => d.id)
    expect(await assignDriver('D-DUP', ids[0])).toBe(true)
    expect(await assignDriver('D-DUP', ids[1])).toBe(true)
    const asg = (supabase as any).__tables.delivery_assignments as any[]
    expect(asg).toHaveLength(1)
    expect(asg[0].driver_id).toBe(ids[1])
    expect(asg[0].status).toBe('assigned')
    expect(asg[0].accepted_at).toBeNull()
  })
  it('cancelled / delivered order → not dispatchable (denied)', async () => {
    await seedOrder({ order_number: 'D-CXL', status: 'cancelled' })
    await seedOrder({ order_number: 'D-DLV', status: 'delivered' })
    await upsertDriver('QA Rider', '0900000001', 'bike')
    const drvId = (await adminListDrivers()).drivers[0].id
    expect(await assignDriver('D-CXL', drvId)).toBe(false)
    expect(await assignDriver('D-DLV', drvId)).toBe(false)
  })
  it('missing order → denied (ERR_ORDER_NOT_FOUND)', async () => {
    await upsertDriver('QA Rider', '0900000001', 'bike')
    expect(await assignDriver('D-NOPE', (await adminListDrivers()).drivers[0].id)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// §11 — driver identity (041 JWT-bound) + assignment scoping
// ---------------------------------------------------------------------------
describe('3B-2D · driver identity + assignment ownership (041)', () => {
  async function seedLinkedDriver() {
    const drvId = await upsertDriver('JWT Rider', '0900000001', 'bike')
    expect(await linkDriverUser(drvId as string, 'auth-test-user')).toBe(true)
    return drvId as string
  }
  it('JWT-linked driver logs in; unlinked caller does NOT become a driver (ERR_NOT_A_DRIVER)', async () => {
    await seedLinkedDriver()
    expect((await driverLogin())?.name).toBe('JWT Rider')
    await (supabase as any).__reset?.()
    expect(await driverLogin()).toBeNull()
    expect(await myDeliveries()).toEqual([])
  })
  it('driver sees ONLY their assigned deliveries (no unrelated/unassigned orders)', async () => {
    const drvId = await seedLinkedDriver()
    await seedOrder({ order_number: 'D-MINE' })
    await seedOrder({ order_number: 'D-OTHER' })
    await assignDriver('D-MINE', drvId)
    const list = await myDeliveries()
    expect(list.map((a) => a.order_number)).toEqual(['D-MINE'])
    expect(list[0].order_number).not.toBe('D-OTHER')
  })
  it('driver can access/act on their assigned order (accept → picked_up → in_transit)', async () => {
    const drvId = await seedLinkedDriver()
    await seedOrder({ order_number: 'D-ACCEPT', status: 'ready_for_dispatch' })
    await assignDriver('D-ACCEPT', drvId)
    expect(await driverAcceptAssignment('D-ACCEPT')).toBe(true)
    expect(await driverUpdateDeliveryStatus('D-ACCEPT', 'picked_up')).toBe(true)
    const asg = (supabase as any).__tables.delivery_assignments as any[]
    expect(asg[0].status).toBe('picked_up')
    // canonical sync along the spine (036/041)
    const ord = (supabase as any).__tables.orders as any[]
    expect(ord[0].status).toBe('dispatched')
    expect(await driverUpdateDeliveryStatus('D-ACCEPT', 'in_transit')).toBe(true)
    expect(ord[0].status).toBe('in_transit')
  })
  it('driver CANNOT act on an order not assigned to them (unassigned / other driver)', async () => {
    await seedLinkedDriver()
    await seedOrder({ order_number: 'D-NOTMINE', status: 'ready_for_dispatch' })
    expect(await driverAcceptAssignment('D-NOTMINE')).toBe(false)
    expect(await driverUpdateDeliveryStatus('D-NOTMINE', 'picked_up')).toBe(false)
    await (supabase as any).__reset?.()
  })
})

// ---------------------------------------------------------------------------
// §11 — state transitions on the dispatch spine + terminal lock
// ---------------------------------------------------------------------------
describe('3B-2D · dispatch state transitions (canonical spine only)', () => {
  it('ready_for_dispatch → dispatched (admin hop) succeeds; pending→dispatched denied', async () => {
    await seedOrder({ order_number: 'D-DISP', status: 'ready_for_dispatch' })
    const a = await updateOrderStatus('D-DISP', 'dispatched')
    expect(a?.status).toBe('dispatched')
    await seedOrder({ order_number: 'D-ILLEGAL', status: 'pending' })
    // canonical wrapper returns null (never throws) — server rejects the hop
    expect(await updateOrderStatus('D-ILLEGAL', 'dispatched')).toBeNull()
  })
  it('full rider flow reaches delivered (in_transit→arrived→delivered multi-hop)', async () => {
    const drvId = await upsertDriver('Flow Rider', '0900000001', 'bike')
    await linkDriverUser(drvId as string, 'auth-test-user')
    await seedOrder({ order_number: 'D-FULL', status: 'ready_for_dispatch' })
    await assignDriver('D-FULL', drvId as string)
    await driverAcceptAssignment('D-FULL')
    expect(await driverUpdateDeliveryStatus('D-FULL', 'delivered')).toBe(true)
    const ord = (supabase as any).__tables.orders as any[]
    const asg = (supabase as any).__tables.delivery_assignments as any[]
    expect(ord[0].status).toBe('delivered')
    expect(asg[0].status).toBe('delivered')
    // already delivered → blocked
    expect(await driverUpdateDeliveryStatus('D-FULL', 'in_transit')).toBe(false)
  })
  it('cancelled/failed/delivered never sync to a driving state (terminal lock)', async () => {
    const drvId = await upsertDriver('Term Rider', '0900000001', 'bike')
    await linkDriverUser(drvId as string, 'auth-test-user')
    await seedOrder({ order_number: 'D-TERMX', status: 'cancelled' })
    await assignDriver('D-TERMX', drvId as string) // canonical allows pre-dispatch assign
    expect(await driverUpdateDeliveryStatus('D-TERMX', 'picked_up')).toBe(false) // sync blocked
    const ord = (supabase as any).__tables.orders as any[]
    expect(ord[0].status).toBe('cancelled')
  })
  it('regression: 3B-2C kitchen hops + 3B-2A allow-list unchanged', () => {
    expect(ADMIN_ALLOWED_TRANSITIONS['confirmed']).toContain('preparing')
    expect(ADMIN_ALLOWED_TRANSITIONS['preparing']).toContain('ready_for_dispatch')
    expect(ADMIN_ALLOWED_TRANSITIONS['ready_for_dispatch']).toContain('dispatched')
    expect(ADMIN_ALLOWED_TRANSITIONS['dispatched']).toContain('in_transit')
    expect(ADMIN_ALLOWED_TRANSITIONS['in_transit']).toContain('arrived')
    expect(ADMIN_ALLOWED_TRANSITIONS['arrived']).toContain('delivered')
    expect(ADMIN_ALLOWED_TRANSITIONS['delivered']).toEqual([])
    expect(ADMIN_ALLOWED_TRANSITIONS['pending']).not.toContain('dispatched')
    expect(ADMIN_ALLOWED_TRANSITIONS['preparing']).not.toContain('delivered')
  })
})
