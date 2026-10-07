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
