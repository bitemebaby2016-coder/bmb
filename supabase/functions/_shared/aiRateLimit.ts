// ============================================
// Bite Me Baby — Minimal AI Rate Limiter (G5, D5-02)
// ============================================
// In-memory sliding-window counter, per caller key (hashed bearer token),
// per Edge Function isolate. Minimal-by-design:
//   - NO DB migration, NO schema change, NO stored prompt content, NO secrets.
//   - Resets on isolate cold start (documented limitation — it is abuse
//     detection / runaway-call protection, not a billing system).
//   - G8 remains the owner of any durable queue/retry/scheduler state.

export interface RateLimitResult {
  allowed: boolean
  count: number
  remaining: number
  resetMs: number
}

export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private maxRequests = 20,
    private windowMs = 60_000,
    private now: () => number = () => Date.now()
  ) {}

  hit(key: string): RateLimitResult {
    const current = this.now()
    const windowStart = current - this.windowMs
    const timestamps = (this.hits.get(key) || []).filter((ts) => ts > windowStart)
    if (timestamps.length >= this.maxRequests) {
      this.hits.set(key, timestamps)
      const oldest = timestamps[0] ?? current
      return {
        allowed: false,
        count: timestamps.length,
        remaining: 0,
        resetMs: Math.max(0, oldest + this.windowMs - current),
      }
    }
    timestamps.push(current)
    this.hits.set(key, timestamps)
    return {
      allowed: true,
      count: timestamps.length,
      remaining: Math.max(0, this.maxRequests - timestamps.length),
      resetMs: this.windowMs,
    }
  }

  /** Observability helper (STEP 8): current usage without any sensitive data. */
  usage(key: string): number {
    const windowStart = this.now() - this.windowMs
    return (this.hits.get(key) || []).filter((ts) => ts > windowStart).length
  }
}

/**
 * Caller identity key WITHOUT exposing any secret: a non-reversible FNV-1a
 * hash of the bearer token. Distinct callers get distinct buckets; the token
 * value itself is never logged, stored or returned.
 */
export function callerKeyFromToken(token: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return 'caller-' + (hash >>> 0).toString(36)
}
