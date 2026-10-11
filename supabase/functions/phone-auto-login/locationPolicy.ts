// ============================================
// BMB CR-3 — coordinate persistence policy for phone-auto-login.
// PURE TypeScript (no Deno/browser APIs) so it is shared by the Edge Function
// and importable by the repository's unit tests.
//
// Policy (Owner 2026-10-10):
//   * customers.default_latitude/longitude are written ONLY for coordinates
//     whose client-declared source is gps/manual AND that pass WGS84 checks;
//   * there is NO kitchen fallback here — missing/invalid coordinates simply
//     mean "no coordinates" (login still succeeds);
//   * `source` is CLIENT METADATA, not cryptographic proof — this policy
//     prevents accidental fallback persistence, it does NOT make a spoofed
//     GPS claim trustworthy. Server-side zone/fee validation remains the
//     authority for delivery correctness.
// ============================================

/** Client-declared sources that may be persisted as customer default coordinates. */
export const TRUSTED_COORD_SOURCES = ['gps', 'manual'] as const

/** WGS84 sanity check — rejects NaN/Infinity, out-of-range and the 0,0 placeholder. */
export function isValidDeliveryCoord(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude < -90 || latitude > 90) return false
  if (longitude < -180 || longitude > 180) return false
  if (latitude === 0 && longitude === 0) return false
  return true
}

/** True only for the trusted client-declared sources (gps/manual). */
export function isTrustedCoordSource(source: unknown): boolean {
  return source === 'gps' || source === 'manual'
}

/**
 * Should `customers.default_latitude/longitude` be written for this payload?
 * Used by BOTH persist paths (quick-login merge + update_profile) so a request
 * without a trusted source can never write coordinates.
 */
export function shouldPersistDefaultCoords(payload: {
  latitude: unknown
  longitude: unknown
  source?: unknown
}): boolean {
  return isValidDeliveryCoord(payload.latitude, payload.longitude) &&
    isTrustedCoordSource(payload.source)
}
