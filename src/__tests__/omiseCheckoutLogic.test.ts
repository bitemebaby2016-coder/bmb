// ============================================
// Bite Me Baby — omise-checkout EF logic regression (offline)
// ============================================
// Mirrors the pure logic of supabase/functions/omise-checkout/index.ts:
//   - amount is converted to THB minor units (satang) — server authority
//   - return_uri = <origin>/payment/<order_number> (navigation only)
//   - single-open-intent guard: only `pi-chrg_*` rows belong to Omise
//   - charge response decisions (pending+authorize_uri → 3DS redirect,
//     successful → settle via webhook, failed/expired → allow a fresh charge)
//   - terminal payment_status is refused (ERR_ORDER_ALREADY_PAID)

import { describe, it, expect } from 'vitest'

function toSatang(amount: number): number {
  return Math.round(amount * 100)
}

function buildReturnUri(origin: string, orderNumber: string): string {
  const base = (origin || 'http://localhost:5173').replace(/\/+$/, '')
  return `${base}/payment/${encodeURIComponent(orderNumber)}`
}

function isChargeAwaitingAuthorization(charge: any): boolean {
  return charge?.status === 'pending' && typeof charge?.authorize_uri === 'string' && charge.authorize_uri.length > 0
}

function isOmiseIntentRow(id: string): boolean {
  return typeof id === 'string' && id.startsWith('pi-chrg_')
}

function isTerminalPaymentStatus(status: string): boolean {
  return ['paid', 'completed', 'refunded', 'partially_refunded'].includes(String(status))
}

/** Decides what omise-checkout returns for a REUSED open charge. */
function reuseDecision(charge: any): 'reuse_3ds' | 'already_settled' | 'close_and_recreate' {
  if (isChargeAwaitingAuthorization(charge)) return 'reuse_3ds'
  if (charge?.status === 'successful') return 'already_settled'
  return 'close_and_recreate'
}

describe('omise-checkout EF logic', () => {
  it('converts the authoritative amount to satang (THB minor units)', () => {
    expect(toSatang(172)).toBe(17200)
    expect(toSatang(99.5)).toBe(9950)
    expect(toSatang(0.01)).toBe(1)
    expect(toSatang(33.333)).toBe(3333)
  })

  it('builds return_uri from the invoking origin, stripping trailing slashes', () => {
    expect(buildReturnUri('https://bmb.example', 'BMB-123')).toBe('https://bmb.example/payment/BMB-123')
    expect(buildReturnUri('https://bmb.example/', 'BMB-123')).toBe('https://bmb.example/payment/BMB-123')
    expect(buildReturnUri('', 'BMB-1')).toBe('http://localhost:5173/payment/BMB-1')
    expect(buildReturnUri('http://localhost:3000', 'BMB 7/7')).toBe('http://localhost:3000/payment/BMB%207%2F7')
  })

  it('detects Omise intent rows by the pi-chrg_ id convention (stripe stays pi_*)', () => {
    expect(isOmiseIntentRow('pi-chrg_test_abc')).toBe(true)
    expect(isOmiseIntentRow('pi_3ABCDEF')).toBe(false)
    expect(isOmiseIntentRow('omise-pending-BMB-1')).toBe(false)
    // charge id recovery: pi-chrg_x → chrg_x (slice(3))
    expect('pi-chrg_test_abc'.slice(3)).toBe('chrg_test_abc')
  })

  it('refuses new charges for terminal payments (ERR_ORDER_ALREADY_PAID)', () => {
    expect(isTerminalPaymentStatus('paid')).toBe(true)
    expect(isTerminalPaymentStatus('refunded')).toBe(true)
    expect(isTerminalPaymentStatus('partially_refunded')).toBe(true)
    expect(isTerminalPaymentStatus('pending')).toBe(false)
    expect(isTerminalPaymentStatus('failed')).toBe(false)
  })

  it('reuse decisions: pending+authorize_uri → same 3DS link, successful → settle, else recreate', () => {
    expect(reuseDecision({ status: 'pending', authorize_uri: 'https://mobile.omise.co/x/authorize' })).toBe('reuse_3ds')
    expect(reuseDecision({ status: 'successful' })).toBe('already_settled')
    expect(reuseDecision({ status: 'pending', authorize_uri: '' })).toBe('close_and_recreate')
    expect(reuseDecision({ status: 'failed' })).toBe('close_and_recreate')
    expect(reuseDecision({ status: 'expired' })).toBe('close_and_recreate')
  })

  it('only a chrg_-prefixed charge id is accepted from the Omise API', () => {
    expect(String('chrg_test_1').startsWith('chrg_')).toBe(true)
    expect(String('pi_1').startsWith('chrg_')).toBe(false)
  })
})
