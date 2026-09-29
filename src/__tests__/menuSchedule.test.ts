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
import { setMenuSchedule, publishMenuSchedule, getScheduleForDateAdmin, getPublishedScheduleForDate, mirrorPreOrderScheduleGate } from '@/lib/bmbMenuSchedule'

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
})
