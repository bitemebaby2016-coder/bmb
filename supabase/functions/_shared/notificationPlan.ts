// ============================================
// Bite Me Baby — notificationPlan (R48 · Unified Notification Manager — PURE core)
// ============================================
// แผนช่องทางกลาง: รับ event + flags + bindings → ลำดับช่องทางที่จะยิง (web_push ก่อน →
// messenger fallback → line ตาม feature flag) — ไม่มี I/O · ไม่รู้ Deno/DB · test เรียกตรงได้
//
// สอดคล้องสัญญา Owner (R48):
//   - LINE API ยังไม่อนุมัติ → lineMode 'disabled'|'mock' = บันทึกสถานะเท่านั้น ไม่ยิงจริง
//     · เมื่ออนุมัติ = ตั้ง lineMode 'live' (flags.line=true) แล้วใช้แผนเดิม — ไม่ต้องแก้ business logic
//   - Failover: ลอง web_push ก่อน · ไม่มี/ล้มเหลว = ไป messenger (ถ้ามี PSID) ·
//     ไม่มีช่องทางส่งได้เลย = mockIfNone (บันทึก line-mock) เพื่อไม่ให้แถว dead เงียบ
// ============================================

export type NotifyChannel = 'web_push' | 'messenger' | 'line'

export interface ChannelFlags {
  push: boolean
  messenger: boolean
  line: boolean
  /** 'disabled'|'mock' = ยังไม่อนุมัติ (บันทึกอย่างเดียว) · 'live' = ส่งจริง (Owner สลับ flag เมื่อ LINE พร้อม) */
  lineMode: 'disabled' | 'mock' | 'live'
}

export interface ChannelBindings {
  /** มีแถว push_subscriptions ที่ยังใช้ได้ (failure_count ต่ำกว่าเพดาน) */
  hasPushSub: boolean
  /** มี channel_identities(messenger) ที่ active (PSID) */
  hasMessengerId: boolean
  /** notification_prefs.push_enabled (transport opt-out รายลูกค้า) */
  pushEnabled: boolean
  /** notification_prefs.channels[category] (หมวดนี้เปิดรับไหม) */
  categoryEnabled: boolean
}

export interface PlanStep {
  channel: NotifyChannel
  mode: 'send'
}

export interface ChannelPlan {
  steps: PlanStep[]
  /** true = ไม่มีช่องทางส่งได้ + LINE ยังไม่ live → dispatcher บันทึกสถานะ 'mock' (line) แทนปล่อย dead */
  mockIfNone: boolean
}

export const DEFAULT_CHANNEL_FLAGS: ChannelFlags = {
  push: true,
  messenger: true,
  line: false,
  lineMode: 'mock',
}

/** อ่านค่าจาก business_settings.notification_channels (jsonb) — ค่าผิด/หาย = default เสมอ (fail-open ฝั่ง feature ไม่ใช่ฝั่งเงิน) */
export function normalizeChannelFlags(raw: unknown): ChannelFlags {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const lineMode = o.lineMode === 'live' ? 'live' : o.lineMode === 'disabled' ? 'disabled' : o.lineMode === 'mock' ? 'mock' : DEFAULT_CHANNEL_FLAGS.lineMode
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  return {
    push: bool(o.push, DEFAULT_CHANNEL_FLAGS.push),
    messenger: bool(o.messenger, DEFAULT_CHANNEL_FLAGS.messenger),
    // line default false — ยังไม่อนุมัติ (Owner R48) ห้ามเป็น true เอง
    line: lineMode === 'live',
    lineMode,
  }
}

/** สร้างแผน: web_push (ถ้ามี sub+เปิด) → messenger (ถ้ามี PSID) → line เฉพาะตอน live */
export function buildChannelPlan(flags: ChannelFlags, bindings: ChannelBindings): ChannelPlan {
  // หมวดถูกปิดใน notification_prefs = ไม่ส่งช่องทางไหนเลย (in-app row มีของตัวเองอยู่แล้ว)
  if (!bindings.categoryEnabled) return { steps: [], mockIfNone: false }

  const steps: PlanStep[] = []
  if (flags.push && bindings.hasPushSub && bindings.pushEnabled) {
    steps.push({ channel: 'web_push', mode: 'send' })
  }
  if (flags.messenger && bindings.hasMessengerId) {
    steps.push({ channel: 'messenger', mode: 'send' })
  }
  if (flags.line && flags.lineMode === 'live') {
    steps.push({ channel: 'line', mode: 'send' })
  }
  // LINE ยังไม่ live = เก็บสถานะ mock เมื่อไม่มีช่องทางส่งอื่น (เห็นสาเหตุ ไม่ใช่ dead เงียบ)
  const mockIfNone = flags.lineMode !== 'live'
  return { steps, mockIfNone }
}