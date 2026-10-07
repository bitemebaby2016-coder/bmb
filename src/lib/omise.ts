// ============================================
// Bite Me Baby — Omise payment provider (foundation)
// Stripe -> Omise switch (TEST MODE first, live keys later).
// ============================================
// This module is the CLIENT-SAFE seam for the Omise cutover:
//
//   * `OMISE_PUBLISHED_API_KEY_TEST_MODE` (public) — readable in the browser
//     via the `envPrefix` whitelist in vite.config.ts (name has no VITE_
//     prefix, per owner's exact naming).
//   * `OMISE_SECRET_API_KEY_TEST_MODE` (secret) — NEVER read here. The secret
//     stays on the server (Supabase Edge Function / `supabase secrets set`),
//     mirroring the existing Stripe boundary in `paymentGateway.ts`.
//
// The live charge creation still runs through the existing server Edge
// Functions; switching `create-checkout`/`stripe-webhook` to Omise is staged
// in the handoff doc so card checkout keeps working until cutover is verified.
// ============================================

export interface OmiseConfig {
  /** Public Omise.js key (test mode). Safe for the browser. */
  publishedKey: string
  /** True when configured with Omise TEST keys (`pkey_test_` / `skey_test_`). */
  testMode: boolean
  /** True when a real (non-placeholder) published key is present. */
  configured: boolean
}

const PLACEHOLDER_RE = /REPLACE|your_|example/i

/** Published (client) Omise key from env. Empty string when unset. */
export function omisePublishedKey(): string {
  const v = import.meta.env.OMISE_PUBLISHED_API_KEY_TEST_MODE
  return typeof v === 'string' ? v.trim() : ''
}

/** Omise test-mode flag — true when the key embeds `_test_`. */
export function omiseIsTestMode(): boolean {
  return omisePublishedKey().includes('_test_')
}

/** True when a real published key is present (placeholder counts as unset). */
export function isOmiseConfigured(): boolean {
  const k = omisePublishedKey()
  return k.length > 0 && !PLACEHOLDER_RE.test(k)
}

/** Snapshot of the client-visible Omise configuration. */
export function omiseConfig(): OmiseConfig {
  const publishedKey = omisePublishedKey()
  return {
    publishedKey,
    testMode: publishedKey.includes('_test_'),
    configured: publishedKey.length > 0 && !PLACEHOLDER_RE.test(publishedKey),
  }
}

/**
 * Where a charge is created. Kept as a seam so the Omise Edge Function can be
 * wired without touching call sites: the browser only ever invokes this edge
 * route with an `order_number`; the SECRET key and amount re-derivation stay
 * server-side (same contract as the current `create-checkout`).
 */
export const OMISE_CHECKOUT_FUNCTION = 'omise-checkout'

/**
 * Where payment results are recorded (webhook EF). The browser never calls
 * this — Omise POSTs here with the `Omise-Signature` header; the EF verifies
 * the HMAC and writes through the idempotent `record_payment_result` RPC.
 */
export const OMISE_WEBHOOK_FUNCTION = 'omise-webhook'

/** Admin-only refund EF (Omise Refunds API) — mirrors `stripe-refund`. */
export const OMISE_REFUND_FUNCTION = 'omise-refund'

/** Official Omise.js CDN — loaded lazily in the browser, public key only. */
export const OMISE_JS_CDN = 'https://cdn.omise.co/omise.js'

/** Card fields collected by the Omise branch of CardPaymentForm. */
export interface OmiseCardInput {
  name: string
  number: string
  expiration_month: string
  expiration_year: string
  security_code: string
  postal_code?: string
}

/** Result of Omise.js tokenization — `token` is a one-time `tok_...`. */
export interface OmiseTokenResult {
  ok: boolean
  token?: string
  error?: string
}

/** Lazily-kept Omise.js promise — the library must be a singleton per page. */
let omiseJsPromise: Promise<any | null> | null = null

/**
 * Load Omise.js from the official CDN once per page.
 * Resolves `null` when Omise is unconfigured or the script fails (the caller
 * surfaces an honest error — no fabricated success).
 */
export function loadOmiseJs(): Promise<any | null> {
  if (!isOmiseConfigured()) return Promise.resolve(null)
  if (!omiseJsPromise) {
    omiseJsPromise = new Promise<any | null>((resolve) => {
      const w = window as unknown as { Omise?: any }
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${OMISE_JS_CDN}"]`)
      if (existing) {
        if (w.Omise) return resolve(w.Omise)
        existing.addEventListener('load', () => resolve(w.Omise ?? null))
        existing.addEventListener('error', () => resolve(null))
        return
      }
      const s = document.createElement('script')
      s.src = OMISE_JS_CDN
      s.async = true
      s.onload = () => resolve(w.Omise ?? null)
      s.onerror = () => {
        omiseJsPromise = null // allow a retry on the next attempt
        resolve(null)
      }
      document.head.appendChild(s)
    })
  }
  return omiseJsPromise
}

/**
 * Tokenize card fields with Omise.js (PCI scope stays with Omise — the card
 * data is sent from the browser DIRECTLY to Omise, never through our servers).
 * The returned one-time token is handed to the `omise-checkout` EF, which
 * re-derives the amount from the DB before creating the charge.
 */
export async function omiseCreateCardToken(card: OmiseCardInput): Promise<OmiseTokenResult> {
  if (!isOmiseConfigured()) return { ok: false, error: 'ERR_OMISE_NOT_CONFIGURED' }
  const Omise = await loadOmiseJs()
  if (!Omise || typeof Omise.createToken !== 'function') {
    return { ok: false, error: 'ERR_OMISE_JS_UNAVAILABLE' }
  }
  const key = omisePublishedKey()
  try {
    if (typeof Omise.setPublicKey === 'function') Omise.setPublicKey(key)
    else if (typeof Omise.configure === 'function') Omise.configure({ publicKey: key })
  } catch {
    // older builds accept the key only via configure — tried above
  }
  return await new Promise<OmiseTokenResult>((resolve) => {
    try {
      Omise.createToken('card', { ...card }, (status: string, response: any) => {
        if (status === 'successful' && response?.id) {
          resolve({ ok: true, token: String(response.id) })
        } else {
          resolve({
            ok: false,
            error: String(response?.error_message || response?.message || 'ERR_OMISE_TOKEN_FAILED'),
          })
        }
      })
    } catch (e: unknown) {
      resolve({ ok: false, error: String((e as Error)?.message || 'ERR_OMISE_TOKEN_FAILED') })
    }
  })
}
