// ============================================
// Phase 3B Wave 1 — canonical customer order flow (mock-level contracts)
// Mirrors the server rules of migrations 024/025/029 at the client boundary:
//   - ONE creation RPC (create_order_with_items v3, mode params, no client prices)
//   - canonical cancellation (cancel_order: owner window rules, idempotent)
//   - deterministic round instantiation (ensure_rounds_for_date)
//   - server mode gate (available_same_day / available_preorder)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Offline DB mock — same wiring as api.test.ts (in-memory PostgREST fake seeded
// like migration 004). These tests must NEVER touch the real database.
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    subscribeToTable: () => ({ unsubscribe: vi.fn() }),
    unsubscribeFromChannel: () => {},
    default: null,
  }
})

import { supabase } from '@/lib/supabase'

const TOMORROW = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

describe('ensure_rounds_for_date — deterministic rounds for the PRE_ORDER date picker', () => {
  it('creates deterministic active rounds and is idempotent', async () => {
    const date = TOMORROW()
    const r1 = await supabase.rpc('ensure_rounds_for_date', { p_date: date })
    expect(r1.error).toBeNull()
    const read = await supabase.from('delivery_rounds').select('*')
    const rows = ((read.data || []) as any[]).filter((r) => String(r.scheduled_date) === date)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.status === 'active')).toBe(true)
    expect(rows.map((r) => r.id).sort()).toEqual([
      `round-${date.replace(/-/g, '')}-evening`,
      `round-${date.replace(/-/g, '')}-midday`,
      `round-${date.replace(/-/g, '')}-morning`,
    ])
    // idempotent retry — no duplicates
    const r2 = await supabase.rpc('ensure_rounds_for_date', { p_date: date })
    expect(r2.error).toBeNull()
    const read2 = await supabase.from('delivery_rounds').select('*')
    expect(((read2.data || []) as any[]).filter((r) => String(r.scheduled_date) === date)).toHaveLength(3)
  })

  it('rejects a past date', async () => {
    const r = await supabase.rpc('ensure_rounds_for_date', { p_date: '2020-01-01' })
    expect(r.error?.code).toBe('ERR_DATE_IN_PAST')
  })
})

describe('cancel_order — canonical cancellation (owner rules)', () => {
  it('cancels a pending own order and releases round capacity', async () => {
    const order = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 1 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_payment_method: 'promptpay_qr',
      p_order_mode: 'SAME_DAY',
    })
    expect(order.error).toBeNull()
    const before = (await supabase.from('delivery_rounds').select('*')).data!.find((r: any) => r.id === 'round-1')
    const res = await supabase.rpc('cancel_order', { p_order_number: order.data.order_number, p_reason: 'test' })
    expect(res.error).toBeNull()
    expect(res.data.status).toBe('cancelled')
    expect(res.data.capacity_released).toBe(true)
    const after = (await supabase.from('delivery_rounds').select('*')).data!.find((r: any) => r.id === 'round-1')
    expect(Number(after.current_count)).toBe(Number(before.current_count) - 1)
  })

  it('is idempotent for an already-cancelled order', async () => {
    const order = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 1 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
    })
    await supabase.rpc('cancel_order', { p_order_number: order.data.order_number })
    const res = await supabase.rpc('cancel_order', { p_order_number: order.data.order_number })
    expect(res.error).toBeNull()
    expect(res.data.idempotent).toBe(true)
  })

  it('refuses to cancel a non-pending order (window passed semantics)', async () => {
    const order = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 1 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
    })
    // push the order past pending (admin path in production; mock transition helper)
    await supabase.rpc('transition_order_status', { p_order_number: order.data.order_number, p_new_status: 'confirmed' })
    const res = await supabase.rpc('cancel_order', { p_order_number: order.data.order_number })
    expect(res.error?.code).toBe('ERR_CANCEL_WINDOW_PASSED')
  })
})

describe('server mode gate — client cannot order a product in a forbidden mode', () => {
  it('rejects PRE_ORDER for a same-day-only product', async () => {
    const date = TOMORROW()
    await supabase.rpc('ensure_rounds_for_date', { p_date: date })
    const roundId = `round-${date.replace(/-/g, '')}-morning`
    const res = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-2', quantity: 1 }], // available_preorder = false
      p_delivery_round_id: roundId,
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'PRE_ORDER',
      p_scheduled_date: date,
    })
    expect(res.error?.code).toBe('ERR_PRODUCT_MODE_NOT_ALLOWED')
  })

  it('rejects SAME_DAY for a preorder-only product', async () => {
    const res = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-5', quantity: 1 }], // available_same_day = false
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
    })
    expect(res.error?.code).toBe('ERR_PRODUCT_MODE_NOT_ALLOWED')
  })
})

describe('canonical payload hygiene', () => {
  it('server ignores injected client money fields and derives its own totals', async () => {
    const res = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 1 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
      // attempted client money injection — the server contract ignores it
      p_total_amount: 1,
      p_delivery_fee: 1,
    })
    expect(res.error).toBeNull()
    expect(Number(res.data.total_amount)).toBeGreaterThan(Number(res.data.delivery_fee))
  })
})

// ============================================
// §18 Wave 10 coverage (tracking / delivery / payment)
// ============================================

describe('§18 tracking — no timer mutates status; refresh reflects server', () => {
  it('time passing alone never advances order state; only a server transition + refetch does', async () => {
    vi.useFakeTimers()
    try {
      const order = await supabase.rpc('create_order_with_items', {
        p_items: [{ product_id: 'prod-1', quantity: 1 }],
        p_delivery_round_id: 'round-1',
        p_customer_name: 'Somchai Rakdee',
        p_order_mode: 'SAME_DAY',
      })
      expect(order.error).toBeNull()
      const onum = String((order.data as any).order_number)

      // Four tracking-poll cadences elapse with nothing else happening.
      for (let i = 0; i < 4; i++) vi.advanceTimersByTime(20000)

      const mid = await supabase.from('orders').select('*').eq('order_number', onum).single()
      expect((mid.data as any).status).toBe('pending') // elapsed time ≠ progression
      expect((mid.data as any).payment_status).toBe('pending')

      // Server-side lifecycle change (admin path) → visible ONLY through refetch.
      await supabase.rpc('transition_order_status', { p_order_number: onum, p_new_status: 'confirmed' })
      const after = await supabase.from('orders').select('*').eq('order_number', onum).single()
      expect((after.data as any).status).toBe('confirmed')
    } finally {
      vi.useRealTimers()
    }
  })

  it('the tracking read path is read-only: repeated polls never write rows', async () => {
    const { getOrder } = await import('@/lib/bmbAdminApi_orders')
    const { getPaymentIntents } = await import('@/lib/paymentGateway')
    const order = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 1 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
    })
    const onum = String((order.data as any).order_number)
    const before = {
      orders: ((await supabase.from('orders').select('*')).data as any[]).length,
      intents: ((await supabase.from('payment_intents').select('*')).data as any[]).length,
      round: ((await supabase.from('delivery_rounds').select('*')).data as any[]).find((r) => r.id === 'round-1').current_count,
    }

    for (let i = 0; i < 3; i++) {
      const o = await getOrder(onum)
      expect(o?.order_number).toBe(onum)
      await getPaymentIntents({ orderNumber: onum })
    }

    const after = {
      orders: ((await supabase.from('orders').select('*')).data as any[]).length,
      intents: ((await supabase.from('payment_intents').select('*')).data as any[]).length,
      round: ((await supabase.from('delivery_rounds').select('*')).data as any[]).find((r) => r.id === 'round-1').current_count,
    }
    expect(after).toEqual(before) // polling added nothing anywhere
  })
})

describe('§18 delivery — forged client distance is input-only; no client money field', () => {
  it('createOrder payload contains ONLY p_* inputs — no fee/total authority keys', async () => {
    const { createOrder } = await import('@/lib/bmbAdminApi_orders')
    const spy = vi.spyOn(supabase, 'rpc')
    try {
      const created = await createOrder({
        items: [{ product_id: 'prod-1', quantity: 2 }],
        delivery_round_id: 'round-1',
        customer_name: 'Somchai Rakdee',
        dropoff_latitude: 10.71,
        dropoff_longitude: 102.15,
        distance_km: 9999, // forged client distance
        order_mode: 'SAME_DAY',
      })
      expect(created).not.toBeNull()
      expect(spy.mock.calls[0][0]).toBe('create_order_with_items')
      const args = Object.keys(spy.mock.calls[0][1] as Record<string, any>)
      // allow-list of inputs only — money authority never crosses the boundary
      expect(args.every((k) => ['p_items', 'p_delivery_round_id', 'p_delivery_method', 'p_delivery_address', 'p_dropoff_latitude', 'p_dropoff_longitude', 'p_customer_name', 'p_customer_phone', 'p_payment_method', 'p_special_instructions', 'p_promotion_code', 'p_distance_km', 'p_order_mode', 'p_scheduled_date'].includes(k))).toBe(true)
      expect(args).not.toContain('p_total_amount')
      expect(args).not.toContain('p_delivery_fee')
      expect(args).not.toContain('p_subtotal')
      expect(args).not.toContain('p_discount_amount')
      expect(args).not.toContain('p_tax_amount')
      expect(args).not.toContain('p_service_fee')
    } finally {
      spy.mockRestore()
    }
  })

  it('forged distance cannot change the submitted order: subtotal stays product-price-derived', async () => {
    const res = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 2 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
      p_distance_km: 9999,
    })
    expect(res.error).toBeNull()
    const d = res.data as any
    expect(Number(d.subtotal)).toBe(130) // 65 × 2 — distance never touches price
    expect(Number(d.total_amount)).toBe(Number(d.subtotal) - Number(d.discount_amount) + Number(d.delivery_fee))
    // fee follows the SERVER formula (30 + 4/km + 2/item, capped) — not an echoed client value
    expect(Number(d.delivery_fee)).toBe(Math.min(30 + 4 * 9999 + 2 * 2, 9999))
  })
})

describe('§18 payment — COD never paid before delivery; Stripe server-only; retry reuses the order', () => {
  it('COD order cannot be paid before delivered — confirm is rejected, status stays pending', async () => {
    const order = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 1 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
      p_payment_method: 'cash_on_delivery',
    })
    expect(order.error).toBeNull()
    const onum = String((order.data as any).order_number)
    const amt = Number((order.data as any).total_amount)

    const pi = await supabase.rpc('create_payment_intent_record', {
      p_order_number: onum, p_amount: amt, p_method: 'cash_on_delivery', p_provider: 'cod',
    })
    expect(pi.error).toBeNull()
    expect((pi.data as any).status).toBe('pending')

    const conf = await supabase.rpc('confirm_offline_payment', { p_order_number: onum })
    expect(conf.error?.code).toBe('ERR_COD_NOT_DELIVERED')
    const row = await supabase.from('orders').select('*').eq('order_number', onum).single()
    expect((row.data as any).payment_status).toBe('pending') // never paid
  })

  it('money-out is refused on the client and card checkout only goes through the Edge Function', async () => {
    const { refundPayment, createCheckout } = await import('@/lib/paymentGateway')
    const refund = await refundPayment('pi-x', 'test')
    expect(refund.success).toBe(false)
    expect(String(refund.error)).toMatch(/SERVER_SIDE_ONLY/)

    ;(supabase as any).__setInvokeHandler('create-checkout', (body: any) => ({
      data: { ok: true, client_secret: 'cs_test_from_server', payment_intent_id: 'pi_server_1', amount: 9900, order_number: body.order_number },
      error: null,
    }))
    const co = await createCheckout('BMB-TEST-777')
    expect(co.ok).toBe(true)
    expect(co.client_secret).toBe('cs_test_from_server') // secret minted SERVER-side
    expect(co.amount).toBe(9900)
  })

  it('retry after failure creates a new intent for the SAME order — no second order, no cart mutation', async () => {
    const { createPaymentIntent, getPaymentIntents } = await import('@/lib/paymentGateway')
    const { useCartStore } = await import('@/store/cartStore')
    const cartBefore = useCartStore.getState().items.length

    const order = await supabase.rpc('create_order_with_items', {
      p_items: [{ product_id: 'prod-1', quantity: 1 }],
      p_delivery_round_id: 'round-1',
      p_customer_name: 'Somchai Rakdee',
      p_order_mode: 'SAME_DAY',
    })
    const onum = String((order.data as any).order_number)
    const amt = Number((order.data as any).total_amount)
    await createPaymentIntent(onum, amt, 'promptpay_qr')
    await supabase.rpc('mark_payment_failed', { p_order_number: onum, p_reason: 'declined' })

    const spy = vi.spyOn(supabase, 'rpc')
    try {
      const retry = await createPaymentIntent(onum, amt, 'promptpay_qr') // SAME order, new attempt
      expect(retry.success).toBe(true)
      expect(spy.mock.calls.some(([n]) => n === 'create_order_with_items')).toBe(false) // never a second order
    } finally {
      spy.mockRestore()
    }

    const all = (await supabase.from('orders').select('*')).data as any[]
    expect(all.filter((o) => o.order_number === onum)).toHaveLength(1)

    const intents = await getPaymentIntents({ orderNumber: onum })
    expect(intents).toHaveLength(2) // failed attempt + retry, same order
    expect(intents.every((i) => i.order_number === onum)).toBe(true)
    // active-intent selection prefers the retry (pending), never the failed one
    const active = intents.find((i) => i.status === 'pending' || i.status === 'processing')
    expect(active?.status).toBe('pending')

    expect(useCartStore.getState().items.length).toBe(cartBefore) // cart untouched
  })
})
