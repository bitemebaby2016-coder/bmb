// ============================================
// Bite Me Baby — Stripe webhook signature verification (WebCrypto) regression
// ============================================
// Guards the STRIPE GATE finding (2026-09-19): the deployed stripe-webhook EF
// fed RAW BYTES to crypto.subtle.sign() instead of an imported CryptoKey, so
// EVERY signature check threw (caught → false) and every real Stripe delivery
// was rejected with HTTP 400. The fix = crypto.subtle.importKey('raw', ...)
// first. This mirrors the fixed EF logic exactly, using Node's webcrypto.

import { describe, it, expect } from 'vitest'

const subtle = globalThis.crypto.subtle
const encoder = new TextEncoder()

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// sign using the FIXED WebCrypto pattern (importKey required)
async function hmacHex(secret: string, ts: number, payload: string): Promise<string> {
  const cryptoKey = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await subtle.sign('HMAC', cryptoKey, encoder.encode(`${ts}.${payload}`))
  return hex(new Uint8Array(sig))
}

// mirror of the EF verifyStripeSignature (fixed implementation)
function parseHeader(header: string) {
  const fields = new Map<string, string>()
  for (const part of header.split(',')) {
    const [k, v] = part.trim().split('=', 2)
    if (k && v) fields.set(k, v)
  }
  return fields
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): Promise<boolean> {
  const fields = parseHeader(signatureHeader)
  const timestamp = fields.get('t')
  const signature = fields.get('v1')
  if (!timestamp || !signature) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const computed = await hmacHex(secret, Number(timestamp), payload)
  return timingSafeEqualHex(computed, signature)
}

describe('Stripe webhook HMAC verification (WebCrypto)', () => {
  const secret = 'whsec_test_abcdefghijklmnopqrstuvwxyz0123456789'
  const ts = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded', data: { object: { id: 'pi_test', amount: 11100, currency: 'thb' } } })

  it('accepts a valid HMAC signature (importKey + sign pattern)', async () => {
    const header = `t=${ts},v1=${await hmacHex(secret, ts, payload)}`
    expect(await verifyStripeSignature(payload, header, secret)).toBe(true)
  })

  it('rejects a signature made with the wrong secret', async () => {
    const header = `t=${ts},v1=${await hmacHex(secret + 'x', ts, payload)}`
    expect(await verifyStripeSignature(payload, header, secret)).toBe(false)
  })

  it('rejects a tampered body (signature does not match)', async () => {
    const header = `t=${ts},v1=${await hmacHex(secret, ts, payload)}`
    const tampered = payload.replace('pi_test', 'pi_evil')
    expect(await verifyStripeSignature(tampered, header, secret)).toBe(false)
  })

  it('rejects an unsigned/incomplete header', async () => {
    expect(await verifyStripeSignature(payload, '', secret)).toBe(false)
    expect(await verifyStripeSignature(payload, 't=123', secret)).toBe(false)
  })

  it('GUARDS the crypto.subtle.sign misuse: raw bytes are NOT a CryptoKey', async () => {
    // The pre-fix code passed bytes directly to subtle.sign → TypeError.
    await expect(async () => {
      await (subtle.sign as any)('HMAC', { name: 'HMAC', hash: 'SHA-256' }, encoder.encode(secret), encoder.encode(`${ts}.${payload}`))
    }).rejects.toThrow()
    // The fixed path succeeds:
    const cryptoKey = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    await expect(subtle.sign('HMAC', cryptoKey, encoder.encode(`${ts}.${payload}`))).resolves.toBeDefined()
  })
})