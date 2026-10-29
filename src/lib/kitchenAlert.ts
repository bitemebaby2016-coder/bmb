// ============================================
// Bite Me Baby — Kitchen order ALERT sound (Master Prompt Task 3 · T3-a)
// ============================================
// คู่กับระบบพิมพ์ใบสั่งครัว R21: ออเดอร์เข้า = "เสียงเตือนดังชัด" ทันที
// กติกา:
//   * detectNewPendingOrders = PURE (test ตรง ๆ) — เทียบหน้าก่อน/หลัง คืนเลขที่ใหม่
//     ที่สถานะ pending (โหลดแรก = ให้ caller ปิด baseline เงียบเอง — ไม่แอบตัดสินในนี้)
//   * playKitchenChime = สังเคราะห์เสียง 3 โน้ตด้วย WebAudio (ไม่มีไฟล์เสียง —
//     ไม่มีปัญหาสินทรัพย์/ลิขสิทธิ์ · ไม่โหลดอะไรเพิ่ม) · throttle กันถี่เกินไป
//   * นโยบายเบราว์เซอร์: AudioContext ถูกบล็อกถ้าไม่มี user gesture — จุดที่ wire
//     คือหน้าแอดมิน (มีการกดปุ่ม/โฟกัสอยู่แล้ว) และที่ปุ่ม "ยืนยันออเดอร์" (gesture ตรง ๆ)
//   * ไม่มี AudioContext (jsdom/เก่า) → คืน false เงียบ ๆ ห้าม throw
// ============================================

export interface AlertOrderLike {
  order_number: string
  status: string
}

/**
 * รายการเลขออเดอร์ที่ "เข้ามาใหม่" — pending ใน `next` ที่ไม่มีใน `prev`
 * - ตัดสินเฉพาะเลข + สถานะ ไม่ยิง network (pure — test ตรง ๆ ได้)
 * - ข้อมูลเพี้ยน (ไม่ใช่อาร์เรย์/ไม่มีเลข) ถูกข้าม ห้ามพัง
 */
export function detectNewPendingOrders(prev: AlertOrderLike[], next: AlertOrderLike[]): string[] {
  const before = new Set(
    (Array.isArray(prev) ? prev : [])
      .map((o) => o?.order_number)
      .filter((n): n is string => typeof n === 'string' && n.length > 0),
  )
  const fresh: string[] = []
  for (const o of Array.isArray(next) ? next : []) {
    const num = o?.order_number
    if (typeof num !== 'string' || num.length === 0) continue
    if (o.status === 'pending' && !before.has(num) && !fresh.includes(num)) fresh.push(num)
  }
  return fresh
}

/** อย่างน้อย 800ms ระหว่าง 2 ครั้ง — กันเสียงทับกันฟังไม่รู้เรื่อง */
const CHIME_THROTTLE_MS = 800
let lastChimeAt = 0

type AudioCtxCtor = typeof AudioContext

function resolveAudioCtx(): AudioCtxCtor | null {
  const w = globalThis as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/**
 * เล่นเสียงเตือนเข้าครัว (3 โน้ต สั้น ดังชัด)
 * @returns true = เล่นแล้ว · false = ไม่มี/โดนบล็อก/ถูก throttle (ไม่ throw ทุกกรณี)
 */
export function playKitchenChime(): boolean {
  try {
    const Ctx = resolveAudioCtx()
    if (!Ctx) return false
    const now = Date.now()
    if (now - lastChimeAt < CHIME_THROTTLE_MS) return false
    lastChimeAt = now

    const ctx = new Ctx()
    const notes = [880, 1174.66, 1567.98] // A5 → D6 → G6 — แหลมทะลุเสียงพัดลมครัว
    const start = ctx.currentTime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      const t0 = start + i * 0.18
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.01)
      gain.gain.setValueAtTime(0.5, t0 + 0.12)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.18)
    })
    setTimeout(() => { void ctx.close().catch(() => undefined) }, 900)
    return true
  } catch {
    return false
  }
}