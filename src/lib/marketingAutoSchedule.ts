// ============================================
// Bite Me Baby — CAP-22 AI Auto-Schedule (ให้ AI เลือกเวลาโพสต์อัตโนมัติ)
// ============================================
// Owner directive 2026-10-26: "AI Studio + ตั้งเวลาโพสต์ AI เลือกเวลา/โพสอัตโนมัติเต็มรูปแบบ"
//
// ระบบที่มีอยู่แล้ว (ไฟล์นี้ต่อให้ครบ ไม่สร้างทางที่สอง):
//   สร้างโพสต์ → content_approvals (คนอนุมัติ "เท่านั้น" — CNT-01 ห้าม auto-approve)
//     → marketing_schedule_post (RPC 137/147 · server บังคับ approval='approved')
//     → marketing_publish (automation-scheduler รายชั่วโมง → queue → worker) = โพสต์เองเมื่อถึงเวลา
//
// ส่วนที่ขาด = "ใครเลือกเวลา" → ไฟล์นี้:
//   · `pickPostSlot` = เลือกเวลาที่ดีที่สุดจาก marketing_rules จริง (publishing window /
//     cooldown / frequency cap) + เลี่ยงเวลาที่ตั้งไว้แล้ว → คะแนนสูงสุด
//   · `autoScheduleApprovedPosts` = ดึงโพสต์ status='approved' ที่ยังไม่มีเวลา → เลือกเวลา
//     → เรียก `scheduleMarketingPost` (ของเดิมทุกบรรทัด)
//
// ข้อจำกัดที่จงใจ (ห้ามลบ):
//   1. ไม่แตะ approval — "อนุมัติ" ยังเป็นหน้าที่คนเสมอ
//   2. ไม่มี publish path ใหม่ — ระบบโพสต์ยังเป็น marketing_publish worker ตัวเดิม
//   3. ห้ามเลือกโพสต์ที่ไม่ใช่ 'approved' — server ก็เช็กซ้ำอยู่แล้ว (defense in depth)
// ============================================

import {
  listMarketingPosts,
  scheduleMarketingPost,
  getMarketingRules,
  type MarketingPostRow,
  type MarketingRules,
} from './adminMarketing'

/** ชั่วโมงที่คนอ่าน/สั่งอาหารมาก (ให้คะแนนสูง — ความรู้ธุรกิจของร้าน ไม่ใช่ค่าสุ่ม) */
const PREFERRED_HOURS_BKK: readonly number[] = [11, 12, 13, 17, 18, 19]

/** ค่า fallback เมื่อยังไม่มีแถว marketing_rules (ปลอดภัย = เงียบ ไม่โพสต์ถี่เกินไป) */
const FALLBACK_RULES: Pick<MarketingRules, 'frequency_per_week' | 'publishing_window' | 'cooldown_hours'> = {
  frequency_per_week: 3,
  publishing_window: { start: '09:00', end: '20:00' },
  cooldown_hours: 4,
}

export interface SlotContext {
  /** เวลาเริ่ม/จบหน้าต่างเผยแพร่จาก marketing_rules ("HH:MM" เวลากรุงเทพ) */
  windowStart: string
  windowEnd: string
  /** เว้นห่างโพสต์อื่นอย่างน้อยกี่ชั่วโมง */
  cooldownHours: number
  /** โพสต์ที่ตั้งเวลาแล้วในสัปดาห์นี้ */
  scheduledThisWeek: number
  /** เพดานโพสต์ต่อสัปดาห์ */
  frequencyPerWeek: number
  /** เวลาที่ตั้งไว้แล้ว (ISO) ของโพสต์อื่น — ใช้เลี่ยงการชน */
  existingScheduledIso: string[]
}

/** แปลง "HH:MM" (เวลากรุงเทพ) → นาทีของวัน */
function hhmmToMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** UTC ms → "นาทีของวัน" ตามเวลากรุงเทพ (UTC+7) */
function bkkMinutesOfDay(utcMs: number): number {
  return Math.floor(((utcMs + 7 * 3_600_000) % 86_400_000) / 60_000)
}

/**
 * สร้างเวลา ISO ของวัน `dayOffset` ตามเวลากรุงเทพ ณ `fromUtcMs`
 * (ใช้ offset +7 ตรง ๆ — ไทยไม่มี DST จึงตรงกับเวลาจริงเสมอ)
 */
export function bkkIsoAt(dayOffset: number, minutesOfDay: number, fromUtcMs: number): string {
  const bkkDayStartUtc = Math.floor((fromUtcMs + 7 * 3_600_000) / 86_400_000) * 86_400_000 - 7 * 3_600_000
  return new Date(bkkDayStartUtc + dayOffset * 86_400_000 + minutesOfDay * 60_000).toISOString()
}

/** ให้คะแนนช่วงเวลา (ยิ่งสูงยิ่งดี) — -1 = ใช้ไม่ได้ (นอกหน้าต่าง / ชน cooldown ของโพสต์อื่น) */
export function scoreSlot(slotUtcMs: number, ctx: SlotContext): number {
  const startMin = hhmmToMinutes(ctx.windowStart)
  const endMin = hhmmToMinutes(ctx.windowEnd)
  if (startMin === null || endMin === null) return -1
  const nowMin = bkkMinutesOfDay(slotUtcMs)
  if (nowMin < startMin || nowMin > endMin) return -1

  const cooldownMs = Math.max(0, ctx.cooldownHours) * 3_600_000
  for (const iso of ctx.existingScheduledIso) {
    const t = Date.parse(iso)
    if (Number.isNaN(t)) continue
    if (Math.abs(t - slotUtcMs) < cooldownMs) return -1
  }

  const hour = Math.floor(nowMin / 60)
  let score = PREFERRED_HOURS_BKK.includes(hour) ? 100 : 60
  score += Math.min(nowMin - startMin, endMin - nowMin) / 60
  return score
}

export interface SlotChoice {
  iso: string
  score: number
}

/**
 * หาเวลาที่ดีที่สุดในช่วง `daysAhead` วันข้างหน้า (ตารางครึ่งชั่วโมงภายในหน้าต่างเผยแพร่)
 * - ไม่คืนเวลาในอดีต
 * - ไม่คืนเวลาชน cooldown ของโพสต์อื่น (ดู scoreSlot)
 * - ชนเพดาน frequency_per_week = คืน null (ไม่โพสต์ถี่เกินกติกา)
 */
export function pickPostSlot(
  ctx: SlotContext,
  nowUtcMs: number,
  opts: { daysAhead?: number; startDayOffset?: number } = {},
): SlotChoice | null {
  // frequency_per_week = 0 หมายถึง "ปิดการตั้งเวลาอัตโนมัติ" (ปลอดภัยกว่าแปลเป็นไม่จำกัด)
  if (ctx.frequencyPerWeek <= 0) return null
  if (ctx.scheduledThisWeek >= ctx.frequencyPerWeek) return null
  const startMin = hhmmToMinutes(ctx.windowStart)
  const endMin = hhmmToMinutes(ctx.windowEnd)
  if (startMin === null || endMin === null) return null

  const days = Math.max(1, opts.daysAhead ?? 7)
  const first = Math.max(0, opts.startDayOffset ?? 1)
  let best: SlotChoice | null = null

  for (let d = first; d < first + days; d++) {
    for (let m = startMin; m <= endMin; m += 30) {
      const iso = bkkIsoAt(d, m, nowUtcMs)
      const t = Date.parse(iso)
      if (Number.isNaN(t) || t <= nowUtcMs) continue
      const score = scoreSlot(t, ctx)
      if (score < 0) continue
      if (!best || score > best.score) best = { iso, score }
    }
  }
  return best
}

export interface SchedulePlanItem {
  id: string
  title: string
  iso: string
}

/**
 * วางแผนตั้งเวลาให้โพสต์ทีละตัว (pure — ไม่ยิง network):
 *  1. เฉพาะ status='approved' และยังไม่มี scheduled_for (กติกา CNT-01)
 *  2. แต่ละตัวได้เวลาไม่ซ้ำกัน + ห่างกันไม่ต่ำกว่า cooldown
 *  3. หมดเพดาน frequency_per_week = หยุด (คืนเฉพาะที่จัดได้)
 */
export function planSchedule(input: {
  posts: MarketingPostRow[]
  rules: Pick<MarketingRules, 'frequency_per_week' | 'publishing_window' | 'cooldown_hours'> | null
  nowUtcMs: number
  daysAhead?: number
}): SchedulePlanItem[] {
  const rules = input.rules
  const scheduledRows = input.posts.filter((p) => p.status === 'scheduled' && p.scheduled_for)
  const ctx: SlotContext = {
    windowStart: rules?.publishing_window?.start ?? FALLBACK_RULES.publishing_window.start,
    windowEnd: rules?.publishing_window?.end ?? FALLBACK_RULES.publishing_window.end,
    cooldownHours: rules?.cooldown_hours ?? FALLBACK_RULES.cooldown_hours,
    // เพดานต่อสัปดาห์ต้องนับ "ที่ตั้งไว้แล้ว" ด้วย ไม่งั้นข้ามเพดานได้
    scheduledThisWeek: scheduledRows.length,
    frequencyPerWeek: rules?.frequency_per_week ?? FALLBACK_RULES.frequency_per_week,
    existingScheduledIso: scheduledRows.map((p) => p.scheduled_for as string),
  }

  const eligible = input.posts.filter((p) => p.status === 'approved' && !p.scheduled_for)
  const out: SchedulePlanItem[] = []
  for (const p of eligible) {
    const choice = pickPostSlot(ctx, input.nowUtcMs, { daysAhead: input.daysAhead })
    if (!choice) break
    out.push({ id: p.id, title: p.title, iso: choice.iso })
    ctx.existingScheduledIso.push(choice.iso)
    ctx.scheduledThisWeek += 1
  }
  return out
}

export interface AutoScheduleResult {
  scheduled: number
  failed: number
  skipped: number
  errors: Array<{ id: string; error: string }>
  plan: SchedulePlanItem[]
}

/**
 * CAP-22 — ตั้งเวลาโพสต์อนุมัติแล้วอัตโนมัติ:
 * ดึงโพสต์จริง → วางแผนด้วย marketing_rules จริง → เรียก `scheduleMarketingPost`
 * (RPC เดิม · server เช็ก approval ซ้ำ · ระบบโพสต์จริงยังเป็น marketing_publish worker ตัวเดิม)
 *
 * `deps` รับ injection ได้เพื่อให้ test รัน offline โดยไม่ต้องพึ่งฐานข้อมูล
 */
export async function autoScheduleApprovedPosts(
  deps: {
    listPosts?: () => Promise<MarketingPostRow[]>
    getRules?: () => Promise<Pick<MarketingRules, 'frequency_per_week' | 'publishing_window' | 'cooldown_hours'> | null>
    schedule?: (id: string, iso: string) => Promise<{ ok: boolean; error?: string }>
    nowUtcMs?: number
    daysAhead?: number
  } = {},
): Promise<AutoScheduleResult> {
  const listPosts = deps.listPosts ?? listMarketingPosts
  const getRules = deps.getRules ?? getMarketingRules
  const schedule = deps.schedule ?? scheduleMarketingPost
  const nowUtcMs = deps.nowUtcMs ?? Date.now()

  const [posts, rules] = await Promise.all([listPosts(), getRules()])
  const plan = planSchedule({ posts, rules, nowUtcMs, daysAhead: deps.daysAhead })

  const planned = new Set(plan.map((p) => p.id))
  let failed = 0
  const errors: Array<{ id: string; error: string }> = []
  for (const item of plan) {
    const r = await schedule(item.id, item.iso)
    if (!r.ok) {
      failed += 1
      errors.push({ id: item.id, error: r.error || 'ERR_SCHEDULE_FAILED' })
    }
  }

  // ทุกโพสต์ที่ไม่ได้อยู่ในแผน = ข้าม (ยังไม่อนุมัติ / มีเวลาแล้ว / ไม่มีช่องว่างตามกติกา)
  const skipped = posts.filter((p) => !planned.has(p.id)).length
  const scheduled = plan.length - failed
  return { scheduled, failed, skipped, errors, plan }
}