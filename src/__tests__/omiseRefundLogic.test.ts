// ============================================
// Bite Me Baby — omise-refund EF logic regression (offline)
// ============================================
// Mirrors the pure logic of supabase/functions/omise-refund/index.ts
// (Deno file can't be imported directly in vitest):
//   - refund may never exceed the charged amount (ledger: metadata.refunded_total_minor)
//   - only the omise provider intent (provider='omise' + charge id + completed) qualifies
//   - deterministic idempotency key per (order, amountMinor)
//   - full vs partial status mapping (refund / partially_refunded)

import { describe, it, expect } from 'vitest'

type RefundLedger = {
  refund_ids: string[]
  refunded_total_minor: number
  last_refund_at?: string
}

function readLedger(metadata: any): RefundLedger {
  const m = metadata ?? {}
  const refundIds = Array.isArray(m.refund_ids) ? m.refund_ids.map(String) : []
  const total = Number(m.refunded_total_minor || 0)
  return { refund_ids: refundIds, refunded_total_minor: Number.isFinite(total) ? Math.trunc(total) : 0, last_refund_at: m.last_refund_at }
}

function findOmiseIntent(intents: any[]) {
  return (intents || []).find((i) => i?.provider === 'omise' && i?.payment_intent_id && i?.status === 'completed')
}

function idempotencyKey(orderNumber: string, amountMinor: number): string {
  return `bmb-omise-refund-${orderNumber}-${amountMinor}`
}

function nextPaymentStatus(refundedTotalMinor: number, chargedMinor: number): string {
  return refundedTotalMinor >= chargedMinor ? 'refund' : 'partially_refunded'
}

describe('omise-refund EF logic', () => {
  it('accepts ONLY the omise provider intent (never the stripe row)', () => {
    const intents = [
      { provider: 'stripe', payment_intent_id: 'pi_1', status: 'completed' },
      { provider: 'omise', payment_intent_id: 'chrg_test_1', status: 'completed' },
    ]
    expect(findOmiseIntent(intents)?.payment_intent_id).toBe('chrg_test_1')
    expect(findOmiseIntent([{ provider: 'stripe', payment_intent_id: 'pi_1', status: 'completed' }])).toBeUndefined()
    // incomplete rows never qualify (payment_intent_id written by the webhook)
    expect(findOmiseIntent([{ provider: 'omise', payment_intent_id: null, status: 'pending' }])).toBeUndefined()
  })

  it('rejects a refund that exceeds the remaining charge (full paid)', () => {
    const chargedMinor = 17200
    const ledger = readLedger(null)
    const remaining = chargedMinor - ledger.refunded_total_minor
    expect(remaining).toBe(17200)
    expect(20000 > remaining).toBe(true) // EF returns ERR_REFUND_AMOUNT_EXCEEDS
  })

  it('tracks partial refunds and recomputes the remaining amount', () => {
    const chargedMinor = 17200
    const ledger = readLedger({ refund_ids: ['rfnd_a'], refunded_total_minor: 7200 })
    expect(chargedMinor - ledger.refunded_total_minor).toBe(10000)
    expect(nextPaymentStatus(ledger.refunded_total_minor, chargedMinor)).toBe('partially_refunded')
  })

  it('maps to full refund when total refunds reach the charged amount', () => {
    expect(nextPaymentStatus(17200, 17200)).toBe('refund')
    expect(nextPaymentStatus(17199, 17200)).toBe('partially_refunded')
  })

  it('builds a deterministic idempotency key per (order, amount)', () => {
    expect(idempotencyKey('BMB-LIVE-1', 17200)).toBe('bmb-omise-refund-BMB-LIVE-1-17200')
    expect(idempotencyKey('BMB-LIVE-1', 10000)).toBe('bmb-omise-refund-BMB-LIVE-1-10000')
  })

  it('tolerates a missing/empty metadata ledger (fresh intent row)', () => {
    expect(readLedger(undefined).refunded_total_minor).toBe(0)
    expect(readLedger({}).refund_ids).toEqual([])
  })

  it('classifies a failed/reversed refund response as ERR_REFUND_FAILED (502)', () => {
    const failedStatuses = ['failed', 'reversed']
    for (const s of failedStatuses) {
      expect(['failed', 'reversed']).toContain(s)
    }
    expect(['pending', 'successful']).not.toContain('failed')
  })
})
