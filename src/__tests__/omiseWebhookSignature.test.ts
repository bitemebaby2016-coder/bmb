// ============================================
// Bite Me Baby — Omise webhook signature regression (offline mirror)
// ============================================
// Mirrors the verifyOmiseSignature logic in
// supabase/functions/omise-webhook/index.ts (Deno file can't be imported in
// vitest). Scheme: header `Omise-Signature: t=<unix>,v1=<hex>` where
// v1 = HMAC-SHA256(secret, `${t}.${payload}`) — the same construction the
// STRIPE GATE fix (2026-09-19) hardened: WebCrypto importKey('raw', ...) is
// REQUIRED, raw bytes are NOT a CryptoKey.

import { describe, it, expect } from 'vitest'

const subtle = globalThis.crypto.subtle
const encoder = new TextEncoder()

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(secret: string, ts: number, payload: string): Promise<string> {
  const cryptoKey = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await subtle.sign('HMAC', cryptoKey, encoder.encode(`${ts}.${payload}`))
  return hex(new Uint8Array(sig))
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Mirror of the omise-webhook EF verifyOmiseSignature. */
async function verifyOmiseSignature(payload: string, signatureHeader: string, secret: string): Promise<boolean> {
  const fields = new Map<string, string>()
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.trim().split('=', 2)
    if (k && v) fields.set(k, v)
  }
  const timestamp = fields.get('t')
  const signature = fields.get('v1')
  if (!timestamp || !signature) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const computed = await hmacHex(secret, Number(timestamp), payload)
  return timingSafeEqualHex(computed, signature)
}

describe('Omise webhook Omise-Signature (t/v1 HMAC-SHA256)', () => {
  const secret = 'whsec_omise_abcdefghijklmnopqrstuvwxyz0123456789'
  const ts = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify({
    id: 'ev_test_1',
    type: 'charge.complete',
    data: { object: { id: 'chrg_test_abc', status: 'successful', amount: 17200, currency: 'thb', metadata: { order_number: 'BMB-TEST-1' } } },
  })

  it('accepts a valid HMAC signature', async () => {
    const header = `t=${ts},v1=${await hmacHex(secret, ts, payload)}`
    expect(await verifyOmiseSignature(payload, header, secret)).toBe(true)
  })

  it('rejects a signature made with the wrong secret', async () => {
    const header = `t=${ts},v1=${await hmacHex(secret + 'x', ts, payload)}`
    expect(await verifyOmiseSignature(payload, header, secret)).toBe(false)
  })

  it('rejects a tampered body (signature does not match)', async () => {
    const header = `t=${ts},v1=${await hmacHex(secret, ts, payload)}`
    const tampered = payload.replace('chrg_test_abc', 'chrg_test_evil')
    expect(await verifyOmiseSignature(tampered, header, secret)).toBe(false)
  })

  it('rejects an unsigned/incomplete header', async () => {
    expect(await verifyOmiseSignature(payload, '', secret)).toBe(false)
    expect(await verifyOmiseSignature(payload, `t=${ts}`, secret)).toBe(false)
    expect(await verifyOmiseSignature(payload, `v1=${await hmacHex(secret, ts, payload)}`, secret)).toBe(false)
  })

  it('rejects a stale timestamp outside the 300s replay window', async () => {
    const staleTs = ts - 301
    const header = `t=${staleTs},v1=${await hmacHex(secret, staleTs, payload)}`
    expect(await verifyOmiseSignature(payload, header, secret)).toBe(false)
  })

  it('GUARDS the crypto.subtle.sign misuse: raw bytes are NOT a CryptoKey', async () => {
    await expect(async () => {
      await (subtle.sign as any)('HMAC', { name: 'HMAC', hash: 'SHA-256' }, encoder.encode(secret), encoder.encode(`${ts}.${payload}`))
    }).rejects.toThrow()
    const cryptoKey = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    await expect(subtle.sign('HMAC', cryptoKey, encoder.encode(`${ts}.${payload}`))).resolves.toBeDefined()
  })
})
