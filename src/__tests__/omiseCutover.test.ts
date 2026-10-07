// ============================================
// Bite Me Baby — Omise cutover regression (paymentGateway client path)
// ============================================
// Guards the Stripe → Omise switch (handoff §5.2 steps 3+5) against the
// in-memory Supabase mock:
//   - createCheckout routes to `omise-checkout` WITH the card token when a
//     real published key is configured (env-driven switch)
//   - result mapping: charge_id / authorize_uri / amount — no client_secret
//   - createPaymentIntent(credit_card) stays pending + provider omise and
//     writes NOTHING client-side (the EF creates the intent row at charge time)
//   - FALLBACK: without a configured key the legacy Stripe path is used
//   - money-out is still refused on the browser (server-side only)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockRef } from './helpers/mockRef'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  const m = createSupabaseMock()
  mockRef.current = m
  return {
    supabase: m,
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import { createCheckout, createPaymentIntent, refundPayment } from '@/lib/paymentGateway'

const CONFIGURED_KEY = 'pkey_test_abc123456789'
const PLACEHOLDER_KEY = 'pkey_test_REPLACE_WITH_OWNER_TEST_KEY'

describe('Omise cutover — paymentGateway client path', () => {
  beforeEach(() => {
    mockRef.current.__reset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('routes createCheckout to omise-checkout with the card token when configured', async () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', CONFIGURED_KEY)
    let invokedWith: any = null
    mockRef.current.__setInvokeHandler('omise-checkout', async (body: any) => {
      invokedWith = body
      return {
        data: {
          ok: true,
          provider: 'omise',
          charge_id: 'chrg_test_1',
          charge_status: 'pending',
          authorize_uri: 'https://mobile.omise.co/chrg_test_1/authorize',
          amount: 17200,
          order_number: body.order_number,
        },
        error: null,
      }
    })

    const res = await createCheckout('BMB-TEST-777', { cardToken: 'tok_visa' })
    expect(invokedWith).toEqual({ order_number: 'BMB-TEST-777', card_token: 'tok_visa' })
    expect(res.ok).toBe(true)
    expect(res.provider).toBe('omise')
    expect(res.charge_id).toBe('chrg_test_1')
    expect(res.payment_intent_id).toBe('chrg_test_1')
    expect(res.authorize_uri).toContain('authorize')
    expect(res.charge_status).toBe('pending')
    expect(res.amount).toBe(17200)
    expect(res.client_secret).toBeUndefined() // Omise never issues a Stripe client_secret
  })

  it('surfaces omise-checkout errors without fabricating success', async () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', CONFIGURED_KEY)
    mockRef.current.__setInvokeHandler('omise-checkout', async () => ({
      data: { ok: false, error: 'ERR_OMISE_API' },
      error: null,
    }))
    const res = await createCheckout('BMB-TEST-778', { cardToken: 'tok_bad' })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('ERR_OMISE_API')
    expect(res.charge_id).toBeUndefined()
  })

  it('createPaymentIntent(credit_card) under Omise stays pending + provider omise, writes nothing', async () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', CONFIGURED_KEY)
    // No invoke handler: an accidental EF call would surface as an error.
    const res = await createPaymentIntent('BMB-TEST-779', 172, 'credit_card')
    expect(res.success).toBe(true)
    expect(res.payment_intent!.status).toBe('pending')
    expect(res.payment_intent!.provider).toBe('omise')
    expect(res.payment_intent!.client_secret).toBeUndefined()
    // The browser never fabricates a payment_intents row (server authority).
    const rows = ((mockRef.current.__tables['payment_intents'] as any[]) || []).filter(
      (i) => i.order_number === 'BMB-TEST-779',
    )
    expect(rows).toHaveLength(0)
  })

  it('FALLBACK: without a configured key the legacy Stripe create-checkout path is used', async () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', PLACEHOLDER_KEY)
    mockRef.current.__setInvokeHandler('omise-checkout', async () => {
      throw new Error('omise-checkout must NOT be invoked when unconfigured')
    })
    mockRef.current.__setInvokeHandler('create-checkout', async (body: any) => ({
      data: { ok: true, client_secret: 'cs_test_from_server', payment_intent_id: 'pi_3stripe', amount: 9900, order_number: body.order_number },
      error: null,
    }))
    const res = await createCheckout('BMB-TEST-780')
    expect(res.ok).toBe(true)
    expect(res.client_secret).toBe('cs_test_from_server')
    expect(res.provider).toBeUndefined() // legacy path carries no provider tag
    expect(res.authorize_uri).toBeUndefined()
  })

  it('money-out is refused on the client even on the Omise path', async () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', CONFIGURED_KEY)
    const refund = await refundPayment('chrg_test_1', 'test')
    expect(refund.success).toBe(false)
    expect(String(refund.error)).toMatch(/SERVER_SIDE_ONLY/)
  })
})
