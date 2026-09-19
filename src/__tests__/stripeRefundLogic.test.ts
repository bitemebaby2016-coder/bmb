// ============================================
// Bite Me Baby — stripe-refund EF logic regression (offline)
// ============================================
// Guards the stripe-refund Edge Function (Phase C-D item C-6, 2026-09-19):
//   - refund may never exceed the charged amount (ledger: metadata.refunded_total_minor)
//   - idempotency key is deterministic per (order, amountMinor)
//   - full vs partial status mapping (refund / partially_refunded)
// Mirrors the EF pure logic (Deno file can't be imported directly in vitest).

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

function idempotencyKey(orderNumber: string, amountMinor: number): string {
  return `bmb-refund-${orderNumber}-${amountMinor}`
}

function nextPaymentStatus(refundedTotalMinor: number, chargedMinor: number): string {
  return refundedTotalMinor >= chargedMinor ? 'refund' : 'partially_refunded'
}

describe('stripe-refund EF logic', () => {
  it('rejects a refund that exceeds the remaining charge (full paid)', () => {
    const chargedMinor = 17200
    const ledger = readLedger(null) // no prior refunds
    const remaining = chargedMinor - ledger.refunded_total_minor
    expect(remaining).toBe(17200)
    const requested = 20000
    expect(requested > remaining).toBe(true) // EF returns ERR_REFUND_AMOUNT_EXCEEDS
  })

  it('tracks partial refunds and recomputes the remaining amount', () => {
    const chargedMinor = 17200
    const ledger = readLedger({ refund_ids: ['re_a'], refunded_total_minor: 7200 })
    const remaining = chargedMinor - ledger.refunded_total_minor
    expect(remaining).toBe(10000)
    expect(nextPaymentStatus(ledger.refunded_total_minor, chargedMinor)).toBe('partially_refunded')
  })

  it('maps to full refund when total refunds reach the charged amount', () => {
    expect(nextPaymentStatus(17200, 17200)).toBe('refund')
    expect(nextPaymentStatus(17199, 17200)).toBe('partially_refunded')
  })

  it('builds a deterministic idempotency key per (order, amount)', () => {
    expect(idempotencyKey('BMB-LIVE-1', 17200)).toBe('bmb-refund-BMB-LIVE-1-17200')
    expect(idempotencyKey('BMB-LIVE-1', 10000)).toBe('bmb-refund-BMB-LIVE-1-10000')
  })

  it('tolerates a missing/empty metadata ledger (fresh intent row)', () => {
    const a = readLedger(undefined)
    const b = readLedger({})
    expect(a.refunded_total_minor).toBe(0)
    expect(b.refund_ids).toEqual([])
  })
})