// ============================================
// Bite Me Baby — client submit key (migration 124 / WAVE 5A)
// ============================================
// Double-submit protection for `create_order_with_items_i`:
//   • ONE key per ONE submission ("CK-" + uuid) — generated client-side
//   • retry of the SAME payload REUSES its key → server replays the ORIGINAL
//     order (order_submissions, R3) instead of creating a second one
//   • EDITED payload gets a FRESH key — reusing a key with different args
//     raises ERR_IDEMPOTENCY_CONFLICT by design (R1 fingerprint contract)
// Key policy mirrors server R2 (124:154-163): btrim(spaces) non-empty,
// ≤128 chars, no control chars. NULL/omitted key = legacy path (no idempotency).
// ============================================

/** Exact error codes raised by `create_order_with_items_i` (migration 124). */
export const IDEMPOTENCY_ERROR_CODES = [
  'ERR_IDEMPOTENCY_CONFLICT',
  'ERR_IDEMPOTENCY_KEY_INVALID',
  'ERR_IDEMPOTENCY_BAD_RESULT',
] as const

export type IdempotencyErrorCode = (typeof IDEMPOTENCY_ERROR_CODES)[number]

export function isIdempotencyErrorCode(code: string | undefined): code is IdempotencyErrorCode {
  return (IDEMPOTENCY_ERROR_CODES as readonly string[]).includes(code ?? '')
}

/**
 * Extract the 124 idempotency code from a Supabase RPC error, if any.
 * PostgREST surfaces `RAISE EXCEPTION 'ERR_…'` in `message` (SQLSTATE stays in
 * `code`); test mocks put the token in either field.
 */
export function extractIdempotencyErrorCode(error: { message?: unknown; code?: unknown } | null | undefined): IdempotencyErrorCode | null {
  const message = String(error?.message ?? '')
  const code = String(error?.code ?? '')
  return IDEMPOTENCY_ERROR_CODES.find((c) => message.includes(c) || code === c) ?? null
}

/** Customer-facing Thai message per 124 failure (never leaks the other party). */
export function describeIdempotencyError(code: string | undefined): string {
  if (code === 'ERR_IDEMPOTENCY_CONFLICT') {
    return 'การส่งซ้ำถูกตรวจพบว่าข้อมูลไม่ตรงกับครั้งก่อน — ไม่มีการสร้างออเดอร์เพิ่ม กรุณาตรวจสอบตะกร้าแล้วกดสั่งซื้อใหม่'
  }
  if (code === 'ERR_IDEMPOTENCY_KEY_INVALID') {
    return 'คีย์ยืนยันการสั่งซื้อไม่ถูกต้อง — ไม่มีการสร้างออเดอร์ กรุณาลองใหม่'
  }
  if (code === 'ERR_IDEMPOTENCY_BAD_RESULT') {
    return 'ระบบได้รับผลการสั่งซื้อผิดรูปแบบ — ไม่มีการสร้างออเดอร์ กรุณาลองใหม่'
  }
  return `ไม่สามารถสั่งซื้อได้${code ? ` (${code})` : ''} — กรุณาลองใหม่`
}

/** btrim(str) default semantics (spaces only) — mirrors PostgreSQL btrim. */
function btrimSpaces(raw: string): string {
  return raw.replace(/^ +| +$/g, '')
}

/** `[[:cntrl:]]` mirror (0x00-0x1F, 0x7F) — no-control-regex lint safe. */
export function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f) return true
  }
  return false
}

/** R2 verdict — identical to the fail-closed check at 124:160-163. */
export function isValidSubmitKey(raw: string): boolean {
  const key = btrimSpaces(raw)
  return key !== '' && key.length <= 128 && !hasControlChar(key)
}

/** Fresh per-submission key: "CK-" + uuid (39 chars — under the R2 cap). */
export function newSubmitKey(): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
  return `CK-${uuid}`
}

/**
 * Deterministic JSON fingerprint ("same payload?" test for key reuse). Object
 * keys sorted recursively; array order preserved (business data — mirrors R1);
 * numbers are scale-free in JS (13.75630 === 13.7563) like R1 trim_scale.
 */
export function payloadFingerprint(args: Record<string, unknown>): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === 'object') {
      const src = value as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(src).sort()) out[k] = stable(src[k])
      return out
    }
    return value
  }
  return JSON.stringify(stable(args))
}

/** Minimal storage surface (sessionStorage or an in-memory test double). */
export interface SubmitKeyStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORE_PREFIX = 'bmb:submit-key:'

/**
 * Payload-keyed ring of submit keys.
 * - `keyFor(fp)` → SAME key for the same payload across calls (retry-safe),
 *   a fresh key for a different payload.
 * - `release(fp)` → payload settled (order created/replayed) — the next submit
 *   of the same payload is a NEW submission → new key.
 * sessionStorage-backed when available so reload + resubmit reuses the key;
 * otherwise memory-only (still correct in-session).
 */
export class SubmitKeyRing {
  private readonly mem = new Map<string, string>()
  private readonly store: SubmitKeyStore | null

  constructor(store?: SubmitKeyStore | null) {
    if (store !== undefined) {
      this.store = store
      return
    }
    try {
      this.store = typeof sessionStorage !== 'undefined' ? sessionStorage : null
    } catch {
      this.store = null // storage blocked (private mode) → memory only
    }
  }

  keyFor(fingerprint: string): string {
    const hit = this.mem.get(fingerprint) ?? this.store?.getItem(STORE_PREFIX + fingerprint) ?? null
    if (hit) {
      this.mem.set(fingerprint, hit)
      return hit
    }
    const key = newSubmitKey()
    this.mem.set(fingerprint, key)
    try {
      this.store?.setItem(STORE_PREFIX + fingerprint, key)
    } catch {
      /* quota exceeded → memory-only entry is still correct in-session */
    }
    return key
  }

  release(fingerprint: string): void {
    this.mem.delete(fingerprint)
    try {
      this.store?.removeItem(STORE_PREFIX + fingerprint)
    } catch {
      /* ignore — in-memory entry is already gone */
    }
  }

  clear(): void {
    for (const fp of [...this.mem.keys()]) this.release(fp)
  }
}