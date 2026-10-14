// ============================================
// Bite Me Baby — P0 WS5: submit lock (repeated/double submit) regression
// ============================================
// Requirement: no duplicate order submission. The UI lock is NOT database
// idempotency (that is contract 124 territory) — but a second submit while one
// is in flight must return 'conflict' and must NOT create another order.

import { describe, it, expect, vi } from 'vitest'
import { submitSplitOrders, type ChildSubmission } from '@/lib/m1Submit'
import type { ChildOrderPlan, PaymentMethodT } from '@/lib/m1CheckoutPlan'

const child = (id: string) =>
  ({
    order_mode: 'SAME_DAY',
    lines: [{ product_id: id, quantity: 1, customizations: {} }],
  }) as unknown as ChildOrderPlan

describe('submitSplitOrders — double-submit protection', () => {
  it('lock busy -> status conflict, children untouched, createChild NEVER called', async () => {
    const createChild = vi.fn()
    const res = await submitSplitOrders([child('p-1')], 'cash_on_delivery' as PaymentMethodT, {
      createChild,
      lock: { busy: true },
    })
    expect(res.status).toBe('conflict')
    expect(res.children).toEqual([] as ChildSubmission[])
    expect(createChild).not.toHaveBeenCalled()
  })

  it('retry after definite failure resubmits only the failed child (no duplicate create)', async () => {
    const calls: string[] = []
    const createChild = vi.fn(async (c: ChildOrderPlan, attempt: number) => {
      calls.push(`${c.lines[0].product_id}#${attempt}`)
      return attempt === 1 ? { status: 'failed' as const } : { status: 'created' as const, order_number: 'BMB-1' }
    })
    const first = await submitSplitOrders([child('p-1')], 'cash_on_delivery' as PaymentMethodT, {
      createChild,
      lock: { busy: false },
    })
    expect(first.status).toBe('failed')
    const retry = await submitSplitOrders([child('p-1')], 'cash_on_delivery' as PaymentMethodT, {
      createChild,
      lock: { busy: false },
    }, first.children)
    expect(retry.status).toBe('all_created')
    expect(calls).toEqual(['p-1#1', 'p-1#2'])
    expect(createChild).toHaveBeenCalledTimes(2) // exactly one create per attempt, no fan-out
  })
})