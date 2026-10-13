// ============================================
// Bite Me Baby — Cart Isolation Engine tests
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, type IsolationCartItem } from '@/stores/useCartStore'
import { planSplitCheckout, buildDeliveryManifest } from '@/lib/m1CheckoutPlan'
import { submitSplitOrders, describeSplitResult } from '@/lib/m1Submit'

const sameDayItem: IsolationCartItem = { id: 'p-1', name: 'ข้าวผัด', price: 50, quantity: 1, mode: 'SAME_DAY' }
const preItem: IsolationCartItem = { id: 'p-2', name: 'ทุเรียนชีสเค้ก', price: 120, quantity: 1, mode: 'PRE_ORDER' }

beforeEach(() => {
  useCartStore.getState().clearCart()
})

describe('useCartStore — Cart Isolation Engine', () => {
  it('sets the order mode on the first addToCart', () => {
    const res = useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    expect(res).toBe('added')
    expect(useCartStore.getState().order_mode).toBe('SAME_DAY')
    expect(useCartStore.getState().cartTotal).toBe(50)
  })

  it('appends matching-mode items without prompting', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    const res = useCartStore.getState().addToCart(
      { ...sameDayItem, id: 'p-2', name: 'ต้มยำ', price: 80 },
      'SAME_DAY',
    )
    expect(res).toBe('added')
    expect(useCartStore.getState().items).toHaveLength(2)
  })

  it('M1 2D-1: mode mismatch → mixed add keeps both lines with per-line modes (OD-4 superseded)', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    const res = useCartStore.getState().addToCart(preItem, 'PRE_ORDER')
    expect(res).toBe('added')
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(2)
    expect(s.pendingMode).toBeNull()
    expect(s.order_mode).toBe('SAME_DAY') // primary (first) mode preserved
    expect((s.items[0] as { line_mode?: string }).line_mode).toBe('SAME_DAY')
    expect((s.items[1] as { line_mode?: string }).line_mode).toBe('PRE_ORDER')
  })

  it('M1 2D-1: explicitly ineligible mixed line → blocked, cart unchanged', async () => {
    const { useCartStore: cartStore } = await import('@/store/cartStore')
    const base = { id: 'x', name: 'x', price: 10, description: '', category_id: 'c', image_url: '', is_featured: false, prep_minutes: 5, sort_order: 1 } as any
    expect(cartStore.getState().addItem({ ...base, id: 'ok-1', is_available: true, available_same_day: true, available_preorder: true }, 1, {}, 'SAME_DAY')).toBe('added')
    expect(cartStore.getState().addItem({ ...base, id: 'bad-1', is_available: true, available_same_day: true, available_preorder: false }, 1, {}, 'PRE_ORDER')).toBe('blocked')
    expect(cartStore.getState().items).toHaveLength(1)
  })

  it('single-mode compatibility: consecutive SAME_DAY adds keep one mode, no prompt', () => {
    useCartStore.getState().addToCart(sameDayItem, 'SAME_DAY')
    const res = useCartStore.getState().addToCart({ ...sameDayItem, id: 'p-3', name: 'ต้มยำ', price: 80 }, 'SAME_DAY')
    expect(res).toBe('added')
    const s = useCartStore.getState()
    expect(s.order_mode).toBe('SAME_DAY')
    expect(s.items).toHaveLength(2)
    expect(s.items.every((i) => (i as { line_mode?: string }).line_mode === 'SAME_DAY')).toBe(true)
  })
})

// ============================================
// Wave 2D-2 / 2D-4 — split plan (non-mutating) + read-only manifest
// ============================================

const ctx = (over: Partial<Parameters<typeof planSplitCheckout>[1]> = {}) => ({
  payment_method: 'cash_on_delivery' as const,
  delivery_round_id: 'round-20261014-morning',
  scheduled_date: '2026-10-14',
  ...over,
})

describe('2D-2 · planSplitCheckout (deterministic, no RPC)', () => {
  const sd = { product_id: 'p1', quantity: 1, line_mode: 'SAME_DAY' as const }
  const po = { product_id: 'p2', quantity: 2, line_mode: 'PRE_ORDER' as const }

  it('SAME_DAY-only → single child, scheduled_date null (round independent of mode)', () => {
    const r = planSplitCheckout([sd], ctx())
    expect(r.ok).toBe(true)
    expect(r.children).toHaveLength(1)
    expect(r.children[0].order_mode).toBe('SAME_DAY')
    expect(r.children[0].scheduled_date).toBeNull()
    expect(r.children[0].delivery_round_id).toBe('round-20261014-morning')
  })
  it('PRE_ORDER-only → single child carrying the fulfillment date', () => {
    const r = planSplitCheckout([po], ctx())
    expect(r.ok).toBe(true)
    expect(r.children).toHaveLength(1)
    expect(r.children[0].order_mode).toBe('PRE_ORDER')
    expect(r.children[0].scheduled_date).toBe('2026-10-14')
  })
  it('mixed + COD → two children, deterministic order (SAME_DAY first), identities separate', () => {
    const r = planSplitCheckout([po, sd], ctx())
    expect(r.ok).toBe(true)
    expect(r.children.map((c) => c.order_mode)).toEqual(['SAME_DAY', 'PRE_ORDER'])
    expect(r.children[1].lines).toHaveLength(1)
    expect(planSplitCheckout([po, sd], ctx())).toEqual(r) // same input ⇒ same output
  })
  it('mixed + promptpay_qr → MIXED_PAYMENT_UNSUPPORTED (payment safety policy)', () => {
    const r = planSplitCheckout([sd, po], ctx({ payment_method: 'promptpay_qr' }))
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.code === 'MIXED_PAYMENT_UNSUPPORTED')).toBe(true)
    expect(r.children).toHaveLength(0) // nothing submittable
  })
  it('PRE_ORDER without scheduled_date → ERR_MISSING_SCHEDULED_DATE (no guessing)', () => {
    const r = planSplitCheckout([po], ctx({ scheduled_date: null }))
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.code === 'ERR_MISSING_SCHEDULED_DATE')).toBe(true)
  })
  it('line required_round/date conflicts are rejected, not guessed', () => {
    const bad = planSplitCheckout([{ ...sd, required_round_id: 'round-other' }], ctx())
    expect(bad.errors.some((e) => e.code === 'ERR_ROUND_CONFLICT')).toBe(true)
    const badDate = planSplitCheckout([{ ...po, required_scheduled_date: '2026-10-20' }], ctx())
    expect(badDate.errors.some((e) => e.code === 'ERR_DATE_CONFLICT')).toBe(true)
  })
  it('legacy line without mode + no fallback → ERR_AMBIGUOUS_LINE; duplicate lines preserved per child', () => {
    const amb = planSplitCheckout([{ product_id: 'px', quantity: 1 }], ctx())
    expect(amb.errors.some((e) => e.code === 'ERR_AMBIGUOUS_LINE')).toBe(true)
    const fb = planSplitCheckout([{ product_id: 'px', quantity: 1 }, { product_id: 'px', quantity: 1 }], ctx({ fallback_mode: 'SAME_DAY' }))
    expect(fb.ok).toBe(true)
    expect(fb.children[0].lines).toHaveLength(2) // duplicates kept — never silently merged
  })
})

describe('3.1 · submitSplitOrders engine (injected createChild — no RPC)', () => {
  const lock = () => ({ busy: false })
  const child = (mode: 'SAME_DAY' | 'PRE_ORDER') => ({
    order_mode: mode,
    lines: [{ product_id: mode === 'SAME_DAY' ? 'p1' : 'p2', quantity: 1, line_mode: mode }],
    delivery_round_id: 'r1',
    scheduled_date: mode === 'PRE_ORDER' ? '2026-10-14' : null,
    payment_method: 'cash_on_delivery' as const,
  })
  const two = [child('SAME_DAY'), child('PRE_ORDER')]

  it('double click / concurrent submit → conflict, only one execution', async () => {
    const calls: string[] = []
    const deps = { lock: lock(), createChild: async (c: any) => { calls.push(c.order_mode); await new Promise((r) => setTimeout(r, 5)); return { status: 'created' as const, order_number: 'X1' } } }
    const p1 = submitSplitOrders(two, 'cash_on_delivery', deps)
    const r2 = await submitSplitOrders(two, 'cash_on_delivery', deps) // แทรก mid-flight
    const r1 = await p1
    expect(r2.status).toBe('conflict')
    expect(r1.status).toBe('all_created')
    expect(calls).toEqual(['SAME_DAY', 'PRE_ORDER']) // deterministic order, no duplicates
  })

  it('first child succeeds, second fails → partial (never all_created)', async () => {
    const r = await submitSplitOrders(two, 'cash_on_delivery', { lock: lock(), createChild: async (c) => c.order_mode === 'SAME_DAY' ? { status: 'created', order_number: 'A1' } : { status: 'failed', code: 'ERR_CAPACITY_FULL' } })
    expect(r.status).toBe('partial')
    expect(r.children.map((s) => s.outcome?.status)).toEqual(['created', 'failed'])
    expect(describeSplitResult(r)).toContain('บางส่วน')
  })

  it('retry resumes: skips created, retries ONLY the confirmed-failed child', async () => {
    const calls: string[] = []
    const deps = { lock: lock(), createChild: async (c: any) => { calls.push(c.order_mode); return c.order_mode === 'SAME_DAY' ? { status: 'created' as const, order_number: 'A1' } : { status: 'failed' as const, code: 'ERR_X' } } }
    const first = await submitSplitOrders(two, 'cash_on_delivery', deps)
    calls.length = 0
    const second = await submitSplitOrders(two, 'cash_on_delivery', { ...deps, createChild: async (c: any) => { calls.push(c.order_mode); return { status: 'created' as const, order_number: 'B2' } } }, first.children)
    expect(calls).toEqual(['PRE_ORDER']) // created child ไม่ถูก resubmit (duplicate-safe)
    expect(second.status).toBe('all_created')
    expect(second.children[0].outcome?.status).toBe('created')
  })

  it('network timeout → ambiguous ⇒ pending status, never auto-resubmitted on retry', async () => {
    const calls: string[] = []
    const deps = { lock: lock(), createChild: async (c: any) => { calls.push(c.order_mode); return { status: 'ambiguous' as const, detail: 'timeout' } } }
    const first = await submitSplitOrders([child('PRE_ORDER')], 'cash_on_delivery', deps)
    expect(first.status).toBe('pending')
    expect(describeSplitResult(first)).toContain('อย่าสั่งซ้ำ')
    calls.length = 0
    const second = await submitSplitOrders([child('PRE_ORDER')], 'cash_on_delivery', deps, first.children)
    expect(calls).toEqual([]) // ambiguous → ไม่ resubmit อัตโนมัติ (รอ reconciliation)
    expect(second.status).toBe('pending')
  })

  it('mixed + promptpay_qr / credit_card → blocked BEFORE any createChild call', async () => {
    let called = 0
    const deps = { lock: lock(), createChild: async () => { called++; return { status: 'created' as const, order_number: 'X' } } }
    for (const m of ['promptpay_qr', 'credit_card'] as const) {
      const r = await submitSplitOrders(two, m, deps)
      expect(r.status).toBe('blocked')
      expect(r.reason).toContain('cash_on_delivery')
    }
    expect(called).toBe(0)
  })

  it('mixed + COD → proceeds; single-mode any payment method → proceeds (regression)', async () => {
    const deps = () => ({ lock: lock(), createChild: async () => ({ status: 'created' as const, order_number: 'S1' }) })
    expect((await submitSplitOrders(two, 'cash_on_delivery', deps())).status).toBe('all_created')
    for (const m of ['promptpay_qr', 'credit_card', 'cash_on_delivery'] as const) {
      const r = await submitSplitOrders([child('SAME_DAY')], m, deps())
      expect(r.status).toBe('all_created')
    }
  })

  it('all children failed → failed status, accurate message', async () => {
    const r = await submitSplitOrders(two, 'cash_on_delivery', { lock: lock(), createChild: async () => ({ status: 'failed' as const, code: 'ERR_CUTOFF_PASSED' }) })
    expect(r.status).toBe('failed')
    expect(describeSplitResult(r)).toContain('ไม่สำเร็จ')
  })
})

describe('2D-4 · buildDeliveryManifest (read-only grouping)', () => {
  const o = (n: string, d: string | null, r: string | null, m: 'SAME_DAY' | 'PRE_ORDER' = 'SAME_DAY') => ({
    order_number: n, scheduled_date: d, delivery_round_id: r, order_mode: m, payment_method: 'cash_on_delivery',
  })
  it('groups by ACTUAL date+round, keeps every order identity (no merge)', () => {
    const g = buildDeliveryManifest([
      o('A1', '2026-10-14', 'r-morning'), o('A2', '2026-10-14', 'r-morning'), o('B1', '2026-10-14', 'r-midday'),
    ])
    expect(g).toHaveLength(2)
    expect(g.find((x) => x.delivery_round_id === 'r-morning')?.orders.map((x) => x.order_number)).toEqual(['A1', 'A2'])
    expect(g.find((x) => x.delivery_round_id === 'r-midday')?.orders.map((x) => x.order_number)).toEqual(['B1'])
  })
  it('missing round/date → unassigned bucket, never inferred from order_mode', () => {
    const g = buildDeliveryManifest([o('N1', null, null, 'PRE_ORDER'), o('N2', '2026-10-14', null)])
    const unassigned = g.filter((x) => x.scheduled_date == null || x.delivery_round_id == null)
    expect(unassigned.flatMap((x) => x.orders).map((x) => x.order_number).sort()).toEqual(['N1', 'N2'])
  })
  it('duplicate product lines across orders stay separate rows; mixed-mode orders in one group keep mode visible', () => {
    const g = buildDeliveryManifest([o('D1', '2026-10-14', 'r-x'), o('D2', '2026-10-14', 'r-x')])
    expect(g[0].orders).toHaveLength(2)
    expect(g[0].orders[0].order_mode).toBeDefined()
  })
})
