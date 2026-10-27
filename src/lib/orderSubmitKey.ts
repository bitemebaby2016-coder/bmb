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

/**
 * Owner 2026-10-27 ("การสร้างออเดอร์ล้มเหลว" ต้องไม่ใช่คำตอบสุดท้าย): แปลงโค้ด
 * ERR_* ทุกตัวจาก server (create_order_with_items / _i / create_pickup_order_i)
 * เป็นข้อความไทยที่บอก "สาเหตุจริง + วิธีแก้" — idempotency คงข้อความเดิมทุกตัวอักษร
 * (SKIPPED ≠ PASS: โค้ดที่ไม่รู้จัก = โชว์โค้ดดิบไว้เป็นหลักฐาน ไม่เดา)
 */
export function describeOrderSubmitError(code: string | undefined): string {
  if (!code) return 'สร้างออเดอร์ไม่สำเร็จ — ระบบไม่ตอบกลับ กรุณาลองใหม่'
  if (isIdempotencyErrorCode(code)) return describeIdempotencyError(code)
  switch (code) {
    case 'ERR_PRE_ORDER_REQUIRES_ADDRESS':
      return 'พรีออเดอร์ต้องระบุรายละเอียดที่อยู่จัดส่ง (บ้านเลขที่/ซอย/ชั้น) — กรอกที่อยู่ให้ครบแล้วลองใหม่'
    case 'ERR_PRODUCT_MODE_NOT_ALLOWED':
      return 'มีสินค้าที่สั่งแบบ "ส่งวันนี้" ไม่ได้อยู่ในตะกร้า — นำรายการนั้นออก หรือสั่งแบบจองล่วงหน้า'
    case 'ERR_PRE_ORDER_REQUIRES_MENU':
      return 'พรีออเดอร์ต้องมีเมนูจากปฏิทินรอบพิเศษของแอดมินอย่างน้อย 1 รายการในตะกร้า'
    case 'ERR_PRODUCT_NOT_ON_MENU':
      return 'มีสินค้าที่ไม่อยู่ในเมนูของวันจัดส่งที่เลือก — ตรวจสอบรายการในตะกร้าหรือเลือกวันใหม่'
    case 'ERR_CUTOFF_PASSED':
      return 'เลยเวลาปิดรับของรอบนี้แล้ว — เลือกรอบจัดส่งถัดไป'
    case 'ERR_CAPACITY_FULL':
      return 'รอบจัดส่งนี้เต็มแล้ว — เลือกรอบอื่น'
    case 'ERR_ROUND_NOT_FOUND':
    case 'ERR_ROUND_CLOSED':
    case 'ERR_ROUND_DATE':
    case 'ERR_ROUND_DATE_MISMATCH':
    case 'ERR_PRE_ORDER_CUTOFF_UNKNOWN':
      return 'รอบจัดส่งนี้ไม่พร้อมรับออเดอร์ — รีเฟรชหน้าแล้วเลือกรอบใหม่'
    case 'ERR_MISSING_ROUND':
      return 'กรุณาเลือกรอบการจัดส่งก่อนสั่งซื้อ'
    case 'ERR_MISSING_DELIVERY_COORDS':
      return 'กรุณาระบุและยืนยันตำแหน่งจัดส่งบนแผนที่ก่อนสั่งซื้อ'
    case 'ERR_INSUFFICIENT_INGREDIENT':
      return 'วัตถุดิบไม่พอสำหรับบางรายการ — ลดจำนวนหรือตัดรายการนั้นออก'
    case 'ERR_QTY_LIMIT':
      return 'จำนวนสินค้าเกินจำกัดต่อ 1 ออเดอร์ — ลดจำนวนแล้วลองใหม่'
    case 'ERR_PRODUCT_UNAVAILABLE':
      return 'มีสินค้าที่ปิดขายอยู่ในตะกร้า — นำออกแล้วลองใหม่'
    case 'ERR_PRODUCT_NOT_FOUND':
      return 'ไม่พบสินค้าบางรายการในระบบ (อาจถูกลบไปแล้ว) — รีเฟรชหน้าแล้วลองใหม่'
    case 'ERR_STORE_CLOSED':
      return 'ร้านปิดรับสั่งแบบส่งวันนี้นอกเวลาเปิดร้าน — สั่งแบบจองล่วงหน้าแทน หรือรอเวลาเปิดร้าน'
    case 'ERR_DELIVERY_METHOD_ZONE':
      return 'อยู่นอกพื้นที่จัดส่งของวิธีที่เลือก — เปลี่ยนวิธีรับ/จัดส่ง'
    case 'ERR_EXTERNAL_METHOD_DISABLED':
      return 'วิธีจัดส่งภายนอกนี้ยังไม่เปิดใช้งาน — เลือกการจัดส่งของร้าน'
    case 'ERR_BITE_DRIVE_DISABLED':
      return 'การจัดส่งโดยร้านปิดชั่วคราว — เลือกวิธีรับอื่น'
    case 'ERR_CONFIG_MISSING':
      return 'ค่าตั้งร้านยังไม่ครบ (แอดมิน) — แจ้งร้านให้ตั้งค่า Delivery Policy'
    case 'ERR_ORDER_NUMBER_EXHAUSTED':
      return 'ระบบสร้างเลขที่ออเดอร์ไม่สำเร็จ — กดสั่งซื้ออีกครั้ง'
    default:
      return `ไม่สามารถสร้างออเดอร์ได้ (${code}) — กรุณาลองใหม่ หรือแจ้งร้านพร้อมโค้ดนี้`
  }
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