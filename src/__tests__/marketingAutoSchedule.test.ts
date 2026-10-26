// ============================================
// Bite Me Baby — CAP-22 AI Auto-Schedule (AI เลือกเวลา + ตั้งเวลาอัตโนมัติ)
// Owner 2026-10-26 "ทำปิดให้สมบูรณ์" — เคารพ CNT-01 (ห้าม auto-approve/auto-publish path ใหม่)
// ============================================

import { describe, it, expect } from 'vitest'
import type { MarketingPostRow } from '@/lib/adminMarketing'
import {
  autoScheduleApprovedPosts,
  bkkIsoAt,
  pickPostSlot,
  planSchedule,
  scoreSlot,
  type SlotContext,
} from '@/lib/marketingAutoSchedule'
import autoSrc from '../lib/marketingAutoSchedule.ts?raw'
import mkSrc from '../pages/admin/AdminMarketing.tsx?raw'

const NOW = Date.parse('2026-10-26T03:00:00Z') // 10:00 กรุงเทพ
const bkkHour = (iso: string) => (new Date(iso).getUTCHours() + 7) % 24

function ctx(over: Partial<SlotContext> = {}): SlotContext {
  return {
    windowStart: '09:00',
    windowEnd: '20:00',
    cooldownHours: 4,
    scheduledThisWeek: 0,
    frequencyPerWeek: 3,
    existingScheduledIso: [],
    ...over,
  }
}

function post(over: Partial<MarketingPostRow>): MarketingPostRow {
  return {
    id: 'p', approval_id: 'a', title: 't', body: 'b', content_type: 'promo',
    image_urls: [], objective: 'reach', status: 'approved', scheduled_for: null,
    provider_post_id: null, error: null, publish_attempts: 0,
    created_at: '2026-10-25T00:00:00Z', published_at: null,
    ...over,
  } as MarketingPostRow
}

describe('bkkIsoAt/scoreSlot — เลือกเวลาตามหน้าต่างเผยแพร่จริง (UTC+7)', () => {
  it('คืน ISO ของวัน+นาทีตามเวลากรุงเทพ', () => {
    expect(bkkIsoAt(1, 11 * 60, Date.parse('2026-10-26T03:00:00Z'))).toBe('2026-10-27T04:00:00.000Z')
  })
  it('ในหน้าต่าง = ได้คะแนน · นอกหน้าต่าง = -1', () => {
    const inWindow = Date.parse('2026-10-27T05:00:00.000Z') // 12:00 BKK
    const outWindow = Date.parse('2026-10-26T20:00:00.000Z') // 03:00 BKK
    expect(scoreSlot(inWindow, ctx())).toBeGreaterThan(0)
    expect(scoreSlot(outWindow, ctx())).toBe(-1)
  })
  it('ชน cooldown ของโพสต์ที่ตั้งไว้แล้ว = -1 (ไม่ยัดสองโพสต์ชิดกัน)', () => {
    const near = Date.parse('2026-10-27T06:00:00.000Z') // 13:00 BKK · เดิม 12:00 = ห่าง 1 ชม.
    const far = Date.parse('2026-10-27T10:00:00.000Z')  // 17:00 BKK · ห่าง 5 ชม.
    const c = ctx({ existingScheduledIso: ['2026-10-27T05:00:00.000Z'] })
    expect(scoreSlot(near, c)).toBe(-1)
    expect(scoreSlot(far, c)).toBeGreaterThan(0)
  })
})

describe('pickPostSlot — เลือกเวลาที่ดีที่สุด (อนาคต + ในหน้าต่าง + ชั่วโมงยอดนิยม)', () => {
  it('คืนเวลาในอนาคตภายในหน้าต่างและเป็นชั่วโมงที่คนสั่งเยอะ', () => {
    const best = pickPostSlot(ctx(), NOW)
    expect(best).not.toBeNull()
    const t = Date.parse(best!.iso)
    expect(t).toBeGreaterThan(NOW)
    expect([11, 12, 13, 17, 18, 19]).toContain(bkkHour(best!.iso))
    const min = (new Date(best!.iso).getUTCHours() + 7) % 24
    expect(min).toBeGreaterThanOrEqual(9)
    expect(min).toBeLessThan(20)
  })
  it('ชนเพดาน frequency_per_week = ไม่เสนอเวลา (ไม่โพสต์ถี่เกินกติกา)', () => {
    expect(pickPostSlot(ctx({ scheduledThisWeek: 3, frequencyPerWeek: 3 }), NOW)).toBeNull()
    expect(pickPostSlot(ctx({ frequencyPerWeek: 0 }), NOW)).toBeNull() // ปิดเพดาน
  })
})

describe('planSchedule — เฉพาะโพสต์อนุมัติแล้ว · เวลาไม่ซ้ำ · เคารพเพดาน', () => {
  const rules = { frequency_per_week: 5, publishing_window: { start: '09:00', end: '20:00' }, cooldown_hours: 4 }

  it('ข้าม draft/pending/scheduled และมีเฉพาะ approved ที่ยังไม่มีเวลา', () => {
    const plan = planSchedule({
      posts: [
        post({ id: 'ok', status: 'approved' }),
        post({ id: 'draft', status: 'draft' }),
        post({ id: 'pending', status: 'pending_approval' }),
        post({ id: 'done', status: 'scheduled', scheduled_for: '2026-10-27T05:00:00.000Z' }),
        post({ id: 'pub', status: 'published' }),
      ],
      rules, nowUtcMs: NOW,
    })
    expect(plan.map((p) => p.id)).toEqual(['ok'])
  })

  it('หลายโพสต์ได้เวลาไม่ซ้ำและห่างกันไม่ต่ำกว่า cooldown', () => {
    const plan = planSchedule({
      posts: [post({ id: 'a' }), post({ id: 'b' }), post({ id: 'c' })],
      rules, nowUtcMs: NOW,
    })
    expect(plan.length).toBe(3)
    const times = plan.map((p) => Date.parse(p.iso))
    expect(new Set(times).size).toBe(3)
    const sorted = [...times].sort((x, y) => x - y)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(4 * 3_600_000)
    }
  })

  it('เพดานต่อสัปดาห์นับโพสต์ที่ตั้งไว้แล้ว — เต็มแล้วไม่ตั้งเพิ่ม', () => {
    const plan = planSchedule({
      posts: [post({ id: 'new' }), post({ id: 'old', status: 'scheduled', scheduled_for: '2026-10-27T05:00:00.000Z' })],
      rules: { ...rules, frequency_per_week: 1 },
      nowUtcMs: NOW,
    })
    expect(plan).toHaveLength(0)
  })
})

describe('autoScheduleApprovedPosts — เรียกเฉพาะ RPC เดิม เฉพาะโพสต์อนุมัติแล้ว', () => {
  it('ตั้งเวลาให้เฉพาะ approved+ยังไม่มีเวลา · นับข้าม/ล้มเหลวตามจริง', async () => {
    const calls: Array<{ id: string; iso: string }> = []
    const res = await autoScheduleApprovedPosts({
      listPosts: async () => [
        post({ id: 'a1' }),
        post({ id: 'a2' }),
        post({ id: 'draft', status: 'draft' }),
        post({ id: 'scheduled', status: 'scheduled', scheduled_for: '2026-10-27T05:00:00.000Z' }),
      ],
      getRules: async () => ({ frequency_per_week: 5, publishing_window: { start: '09:00', end: '20:00' }, cooldown_hours: 4 }),
      schedule: async (id, iso) => {
        calls.push({ id, iso })
        return id === 'a2' ? { ok: false, error: 'ERR_APPROVAL_REQUIRED' } : { ok: true }
      },
      nowUtcMs: NOW,
    })
    expect(calls.map((c) => c.id)).toEqual(['a1', 'a2']) // ไม่มี draft/scheduled หลุดเข้ามา
    expect(res.scheduled).toBe(1)
    expect(res.failed).toBe(1)
    expect(res.errors[0]).toEqual({ id: 'a2', error: 'ERR_APPROVAL_REQUIRED' })
    expect(res.skipped).toBe(2)
  })

  it('ไม่มีโพสต์ที่เข้าเกณฑ์ = คืนศูนย์ ไม่ยิง schedule เลย', async () => {
    let called = 0
    const res = await autoScheduleApprovedPosts({
      listPosts: async () => [post({ id: 'x', status: 'draft' })],
      getRules: async () => null,
      schedule: async () => { called += 1; return { ok: true } },
      nowUtcMs: NOW,
    })
    expect(called).toBe(0)
    expect(res).toMatchObject({ scheduled: 0, failed: 0, skipped: 1 })
  })
})

describe('CAP-22 contract — ไม่มี publish/approve path ใหม่ (CNT-01 + G7)', () => {
  it('ใช้แค่ scheduleMarketingPost (RPC เดิม) — ไม่แตะ approval/status เอง', () => {
    expect(autoSrc).toContain('schedule(item.id, item.iso)')
    expect(autoSrc).toContain('scheduleMarketingPost')
    expect(autoSrc).not.toContain('reviewContent')
    expect(autoSrc).not.toContain("status: 'published'")
    expect(autoSrc).not.toContain('.update(')
  })

  it('ปุ่ม AI ในหน้าปฏิทินต่อเข้า autoScheduleApprovedPosts', () => {
    expect(mkSrc).toContain('autoScheduleApprovedPosts()')
    expect(mkSrc).toContain('data-testid="mk-auto-schedule"')
    // ยังคง RPC เดิมสำหรับการตั้งเวลาแบบเลือกเองทีละรายการ
    expect(mkSrc).toContain('scheduleMarketingPost(id, new Date(when).toISOString())')
  })
})