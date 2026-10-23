// ============================================
// Bite Me Baby — CAT-02: canonical menu schedule (migration 039, CAT-D02=A)
// Admin RPC flow + server gate mirror + customer read scope
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import { supabase } from '@/lib/supabase'
import { setMenuSchedule, publishMenuSchedule, getScheduleForDateAdmin, getPublishedScheduleForDate, mirrorPreOrderScheduleGate, getScheduleForWeek, isoWeekRange, summarizeWeek, checkPublishReady, checkModeEligibility, type EligibilityItem } from '@/lib/bmbMenuSchedule'

const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

beforeEach(async () => {
  await (supabase as any).__reset?.()
  ;(supabase as any).__setNoAdmin?.(false)
})

describe('CAT-02 · Admin schedule RPC flow (migration 039 contract)', () => {
  it('set → draft rows saved unpublished; publish flips them; replace-all semantics', async () => {
    expect((await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-6', delivery_round_key: 'evening' }])).ok).toBe(true)
    let rows = await getScheduleForDateAdmin(TOMORROW)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => !r.is_published)).toBe(true)
    expect(rows.find((r) => r.product_id === 'prod-6')?.delivery_round_key).toBe('evening')

    expect((await publishMenuSchedule(TOMORROW, true)).ok).toBe(true)
    rows = await getScheduleForDateAdmin(TOMORROW)
    expect(rows.every((r) => r.is_published)).toBe(true)

    // replace-all: a new set replaces the day's rows
    expect((await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }])).ok).toBe(true)
    rows = await getScheduleForDateAdmin(TOMORROW)
    expect(rows).toHaveLength(1)
    expect(rows[0].product_id).toBe('prod-5')
    expect(rows[0].is_published).toBe(false)
  })

  it('non-admin caller → ERR_FORBIDDEN (server authority, not UI hiding)', async () => {
    ;(supabase as any).__setNoAdmin?.(true)
    const res = await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }])
    expect(res.ok).toBe(false)
    expect(res.error).toContain('ERR_FORBIDDEN')
  })

  it('invalid date (past) → ERR_INVALID_MENU_DATE; unknown product → ERR_PRODUCT_NOT_FOUND', async () => {
    const past = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    expect((await setMenuSchedule(past, [{ product_id: 'prod-5' }])).error).toContain('ERR_INVALID_MENU_DATE')
    expect((await setMenuSchedule(TOMORROW, [{ product_id: 'prod-nope' }])).error).toContain('ERR_PRODUCT_NOT_FOUND')
  })
})

describe('CAT-02 · customer read scope (anon-safe published-only)', () => {
  it('getPublishedScheduleForDate returns only published rows of that date', async () => {
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-6' }])
    expect(await getPublishedScheduleForDate(TOMORROW)).toHaveLength(0) // draft invisible
    await publishMenuSchedule(TOMORROW, true)
    expect(await getPublishedScheduleForDate(TOMORROW)).toHaveLength(2)
    expect(await getPublishedScheduleForDate(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10))).toHaveLength(0)
  })
})

describe('CAT-02 · server gate mirror (trg_menu_gate semantics)', () => {
  it('day WITHOUT published schedule → allowed (039: existing available_preorder gate)', () => {
    const res = mirrorPreOrderScheduleGate([{ product_id: 'prod-5', quantity: 1 }], TOMORROW, [])
    expect(res.allowed).toBe(true)
  })

  it('day WITH published schedule → on-menu allowed, off-menu rejected', () => {
    const rows = [
      { id: 'ms-1', scheduled_date: TOMORROW, product_id: 'prod-5', delivery_round_key: null, is_published: true, note: '' },
      { id: 'ms-2', scheduled_date: TOMORROW, product_id: 'prod-6', delivery_round_key: 'evening', is_published: true, note: '' },
    ]
    expect(mirrorPreOrderScheduleGate([{ product_id: 'prod-5', quantity: 1 }], TOMORROW, rows).allowed).toBe(true)
    expect(mirrorPreOrderScheduleGate([{ product_id: 'prod-6', quantity: 1 }], TOMORROW, rows, 'evening').allowed).toBe(true)
    const r1 = mirrorPreOrderScheduleGate([{ product_id: 'prod-6', quantity: 1 }], TOMORROW, rows, 'morning')
    expect(r1.allowed).toBe(false)
    expect(r1.rejected?.[0].code).toBe('ERR_PRODUCT_NOT_ON_MENU')
    const draft = rows.map((r) => ({ ...r, is_published: false }))
    expect(mirrorPreOrderScheduleGate([{ product_id: 'prod-5', quantity: 1 }], TOMORROW, draft).allowed).toBe(true)
  })

  it('R5/141: สินค้าทั่วไป (ไม่มีเมนู) ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้ — ไม่ reject', () => {
    const rows = [
      { id: 'ms-1', scheduled_date: TOMORROW, product_id: 'prod-5', delivery_round_key: null, is_published: true, note: '' },
    ]
    const res = mirrorPreOrderScheduleGate([{ product_id: 'prod-regular', quantity: 1 }], TOMORROW, rows)
    expect(res.allowed).toBe(true)
  })

  it('R5/141: สินค้าเมนูผูกวันอื่น (boundDates จากปฏิทินแอดมิน) → reject', () => {
    const rows = [
      { id: 'ms-1', scheduled_date: TOMORROW, product_id: 'prod-5', delivery_round_key: null, is_published: true, note: '' },
    ]
    const res = mirrorPreOrderScheduleGate([{ product_id: 'prod-5', quantity: 1 }], TOMORROW, rows, null, null, { 'prod-5': '2099-01-01' })
    expect(res.allowed).toBe(false)
    expect(res.rejected?.[0].code).toBe('ERR_PRODUCT_NOT_ON_MENU')
  })
})

// ============================================
// PHASE 1 — Owner Directive: WEEKLY PRE_ORDER MENU CONTROL
// Migration 123 mirror: server is authority (publish_menu_schedule validates);
// these tests exercise the mock mirror + UI-convenience helpers.
// ============================================

describe('PHASE 1 · publish validation exactly 2 valid PRE_ORDER menus (migration 123)', () => {
  it('publish with 1 entry → ERR_MENU_COUNT_INVALID; with 3 → ERR_MENU_COUNT_INVALID; draft of 1 stays allowed', async () => {
    // incomplete draft is fine (Owner #3)
    expect((await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }])).ok).toBe(true)
    const one = await publishMenuSchedule(TOMORROW, true)
    expect(one.ok).toBe(false)
    expect(one.error).toContain('ERR_MENU_COUNT_INVALID')

    const D2 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    await setMenuSchedule(D2, [{ product_id: 'prod-5' }, { product_id: 'prod-6' }, { product_id: 'prod-1' }])
    const three = await publishMenuSchedule(D2, true)
    expect(three.ok).toBe(false)
    expect(three.error).toContain('ERR_MENU_COUNT_INVALID')
    // unpublish stays unconditional so a non-compliant date can be taken off sale
    expect((await publishMenuSchedule(D2, false)).ok).toBe(true)
  })

  it('exactly 2 valid entries → publish ok (control)', async () => {
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-6' }])
    const res = await publishMenuSchedule(TOMORROW, true)
    expect(res.ok).toBe(true)
    expect((await getScheduleForDateAdmin(TOMORROW)).every((r) => r.is_published)).toBe(true)
  })

  it('product disabled AFTER scheduling → publish rejected (ERR_PRODUCT_INVALID)', async () => {
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-6' }])
    const p6 = (supabase as any).__tables.products.find((x: any) => x.id === 'prod-6')
    const prev = p6.is_available
    p6.is_available = false
    const res = await publishMenuSchedule(TOMORROW, true)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('ERR_PRODUCT_INVALID')
    p6.is_available = prev
  })

  it('non-PRE_ORDER product among the 2 → ERR_PRODUCT_INVALID (canonical available_preorder)', async () => {
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-2' }]) // prod-2.available_preorder=false
    const res = await publishMenuSchedule(TOMORROW, true)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('ERR_PRODUCT_INVALID')
  })

  it('duplicate payload entries collapse to 1 row (UNIQUE(date,product)) and still publishable', async () => {
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-5' }, { product_id: 'prod-6' }])
    const rows = await getScheduleForDateAdmin(TOMORROW)
    expect(rows).toHaveLength(2)
    expect((await publishMenuSchedule(TOMORROW, true)).ok).toBe(true)
  })

  it('publish with no schedule → ERR_MENU_NOT_FOUND; non-admin publish → ERR_FORBIDDEN', async () => {
    const D3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    const none = await publishMenuSchedule(D3, true)
    expect(none.ok).toBe(false)
    expect(none.error).toContain('ERR_MENU_NOT_FOUND')

    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-6' }])
    ;(supabase as any).__setNoAdmin?.(true)
    const forb = await publishMenuSchedule(TOMORROW, true)
    expect(forb.ok).toBe(false)
    expect(forb.error).toContain('ERR_FORBIDDEN')
  })

  it('checkout attempt against a disabled product → ERR_PRODUCT_UNAVAILABLE (025 §5 authority)', async () => {
    const round = (supabase as any).__tables.delivery_rounds.find((x: any) => x.id === 'round-1')
    round.scheduled_date = TOMORROW
    round.date = TOMORROW
    const p5 = (supabase as any).__tables.products.find((x: any) => x.id === 'prod-5')
    const prev = p5.is_available
    p5.is_available = false
    const res = await (supabase as any).rpc('create_order_with_items', {
      p_order_mode: 'PRE_ORDER',
      p_delivery_round_id: 'round-1',
      p_scheduled_date: TOMORROW,
      p_customer_name: 'QA',
      p_customer_phone: '0900000000',
      p_items: [{ product_id: 'prod-5', quantity: 1, options: {} }],
    })
    expect(res.error?.code).toBe('ERR_PRODUCT_UNAVAILABLE')
    p5.is_available = prev
  })
})

describe('PHASE 1 · weekly helpers (14 entries/week = 2/day × 7 days — UI mirror only)', () => {
  it('isoWeekRange returns the Mon–Sun week containing the date', () => {
    const [s, e] = isoWeekRange('2026-10-14') // Wednesday
    expect(s <= '2026-10-14' && '2026-10-14' <= e).toBe(true)
    expect(new Date(s + 'T00:00:00').getDay()).toBe(1) // Monday
    expect(new Date(e + 'T00:00:00').getDay()).toBe(0) // Sunday
  })

  it('getScheduleForWeek + summarizeWeek: 7 days, per-day counts and published flags', async () => {
    const [ws, we] = isoWeekRange(TOMORROW)
    await setMenuSchedule(TOMORROW, [{ product_id: 'prod-5' }, { product_id: 'prod-6' }])
    const draftSum = summarizeWeek(ws, await getScheduleForWeek(ws, we))
    expect(draftSum).toHaveLength(7)
    const day = draftSum.find((d) => d.scheduled_date === TOMORROW)
    expect(day?.rows).toBe(2)
    expect(day?.published).toBe(false)

    await publishMenuSchedule(TOMORROW, true)
    const pubSum = summarizeWeek(ws, await getScheduleForWeek(ws, we))
    expect(pubSum.find((d) => d.scheduled_date === TOMORROW)?.published).toBe(true)
    expect(pubSum.filter((d) => d.rows > 0)).toHaveLength(1)
  })

  it('checkPublishReady mirrors server rules (convenience only — server re-validates)', () => {
    const row = (pid: string) => ({ id: `ms-${pid}`, scheduled_date: TOMORROW, product_id: pid, delivery_round_key: null, is_published: false, note: '' })
    const valid = (id: string) => ['a', 'b'].includes(id)
    expect(checkPublishReady([], valid).ready).toBe(false)
    expect(checkPublishReady([row('a')], valid).ready).toBe(false)
    expect(checkPublishReady([row('a'), row('b')], valid).ready).toBe(true)
    expect(checkPublishReady([row('a'), row('b')], (id) => id === 'a').ready).toBe(false)
    expect(checkPublishReady([row('a'), row('x')], valid).reason).toContain('ปิด')
  })
})

describe('WAVE 2B · stale-cart eligibility guard (mirror of 025 §5 — client early block)', () => {
  const mk = (over: Partial<EligibilityItem>): EligibilityItem => ({
    product_id: 'p1', name: 'เมนู A', is_available: true, preorder_ok: true, same_day_ok: true, ...over,
  })
  it('disabled product → rejected for both modes', () => {
    expect(checkModeEligibility([mk({ is_available: false })], 'PRE_ORDER').ok).toBe(false)
    expect(checkModeEligibility([mk({ is_available: false })], 'SAME_DAY').rejected).toEqual(['เมนู A'])
  })
  it('R5/141: PRE_ORDER รับสินค้าทุกตัว (preorder_ok = hint) — SAME_DAY ยังเช็ก same_day_ok', () => {
    expect(checkModeEligibility([mk({ same_day_ok: false })], 'SAME_DAY').ok).toBe(false)
    expect(checkModeEligibility([mk({ preorder_ok: false })], 'PRE_ORDER').ok).toBe(true)
    expect(checkModeEligibility([mk({ same_day_ok: false })], 'PRE_ORDER').ok).toBe(true)
    expect(checkModeEligibility([mk({ preorder_ok: false })], 'SAME_DAY').ok).toBe(true)
  })
  it('all valid → ok; rejected list carries display names', () => {
    expect(checkModeEligibility([mk({}), mk({ product_id: 'p2', name: 'เมนู B' })], 'PRE_ORDER').ok).toBe(true)
    const r = checkModeEligibility([mk({ product_id: 'p9', name: 'ปิดแล้ว', is_available: false })], 'PRE_ORDER')
    expect(r.rejected).toEqual(['ปิดแล้ว'])
  })
})
