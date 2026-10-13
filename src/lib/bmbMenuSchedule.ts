// ============================================
// Bite Me Baby — Menu Schedule lib (CAT-02, CAT-D02=A)
// Canonical operational schedule = migration 039 menu_schedule + RPCs.
// Admin = RPC callers (set_menu_schedule / publish_menu_schedule).
// Customer = read published rows only (anon RLS policy, migration 056).
// Server (trg_menu_gate / trg_operating_hours / 038 window) remains the
// ONLY order-time authority — everything here is a display mirror.
// ============================================

import { supabase } from './supabase'

export interface MenuScheduleRow {
  id: string
  scheduled_date: string
  product_id: string
  delivery_round_key: string | null
  is_published: boolean
  note: string
}

export interface ScheduleSetItem {
  product_id: string
  delivery_round_key?: string | null
  note?: string
}

export interface ScheduleSetResult {
  ok: boolean
  error?: string
}

// ---------- Admin (RPC — server validates admin + date + items) ----------

export async function setMenuSchedule(scheduledDate: string, items: ScheduleSetItem[]): Promise<ScheduleSetResult> {
  const { data, error } = await supabase.rpc('set_menu_schedule', {
    p_scheduled_date: scheduledDate,
    p_items: items.map((i) => ({ product_id: i.product_id, delivery_round_key: i.delivery_round_key ?? '', note: i.note ?? '' })),
  })
  if (error) { console.error('[setMenuSchedule] Error:', error); return { ok: false, error: String(error.message || error.code || 'ERR_MENU_SCHEDULE') } }
  return { ok: !!data?.ok }
}

export async function publishMenuSchedule(scheduledDate: string, publish: boolean): Promise<ScheduleSetResult> {
  const { data, error } = await supabase.rpc('publish_menu_schedule', { p_scheduled_date: scheduledDate, p_publish: publish })
  if (error) { console.error('[publishMenuSchedule] Error:', error); return { ok: false, error: String(error.message || error.code || 'ERR_MENU_SCHEDULE') } }
  return { ok: !!data?.ok }
}

export async function getScheduleForDateAdmin(scheduledDate: string): Promise<MenuScheduleRow[]> {
  const { data, error } = await supabase.from('menu_schedule').select('*').eq('scheduled_date', scheduledDate)
  if (error) { console.error('[getScheduleForDateAdmin] Error:', error); return [] }
  return (data || []) as MenuScheduleRow[]
}

// ---------- Weekly view (7-day strip — Owner #1: 14 entries/week, 2/day) ----------

/** ISO week (Mon–Sun) containing `date` — returns [weekStart, weekEnd] YYYY-MM-DD. */
export function isoWeekRange(date: string): [string, string] {
  const d = new Date(date + 'T00:00:00')
  const day = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - day)
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const start = fmt(d)
  const endD = new Date(d)
  endD.setDate(endD.getDate() + 6)
  return [start, fmt(endD)]
}

/** All schedule rows of an inclusive [from, to] range (one query for the week strip). */
export async function getScheduleForWeek(from: string, to: string): Promise<MenuScheduleRow[]> {
  const { data, error } = await supabase
    .from('menu_schedule').select('*')
    .gte('scheduled_date', from).lte('scheduled_date', to)
  if (error) { console.error('[getScheduleForWeek] Error:', error); return [] }
  return (data || []) as MenuScheduleRow[]
}

export interface WeekDaySummary {
  scheduled_date: string
  rows: number
  published: boolean
}

/**
 * Convenience mirror of migration 123 publish rules for the week strip:
 * per date = number of scheduled entries + whether the date is published.
 * Server (publish_menu_schedule) remains the only authority.
 */
export function summarizeWeek(weekStart: string, rows: MenuScheduleRow[]): WeekDaySummary[] {
  const out: WeekDaySummary[] = []
  const d = new Date(weekStart + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dayRows = rows.filter((r) => r.scheduled_date === key)
    out.push({
      scheduled_date: key,
      rows: dayRows.length,
      published: dayRows.length > 0 && dayRows.every((r) => r.is_published),
    })
    d.setDate(d.getDate() + 1)
  }
  return out
}

export interface PublishReadyResult {
  ready: boolean
  reason?: string
}

/**
 * UI convenience mirror of migration 123 publish validation:
 * exactly 2 rows, and every product is still valid & PRE_ORDER-eligible.
 * Server re-validates — this only pre-disables the Publish button.
 */
export function checkPublishReady(
  rows: MenuScheduleRow[],
  isProductValid: (productId: string) => boolean,
): PublishReadyResult {
  if (rows.length === 0) return { ready: false, reason: 'ยังไม่มี schedule — Save ก่อน' }
  if (rows.length !== 2) return { ready: false, reason: `ต้องมี exactly 2 เมนู (ตอนนี้ ${rows.length})` }
  const invalid = rows.filter((r) => !isProductValid(r.product_id))
  if (invalid.length > 0) {
    return { ready: false, reason: `มีเมนูที่ถูกปิด/ไม่ผ่านเกณฑ์ PRE_ORDER ${invalid.length} รายการ` }
  }
  return { ready: true }
}

// ---------- WAVE 2B: stale-cart eligibility guard (client mirror of 025 §5) ----------

export interface EligibilityItem {
  product_id: string
  name?: string
  is_available: boolean
  preorder_ok: boolean
  same_day_ok: boolean
}

export interface EligibilityResult {
  ok: boolean
  rejected: string[]
}

/**
 * Client mirror of migration 025 §5 (ERR_PRODUCT_UNAVAILABLE /
 * ERR_PRODUCT_MODE_NOT_ALLOWED) for carts hydrated from older persisted state:
 * a product disabled (or mode-restricted) AFTER it entered the cart must not
 * reach the order RPC. Server remains the only authority — this only blocks
 * the submit early with a clear message instead of a late RPC rejection.
 */
export function checkModeEligibility(
  items: EligibilityItem[],
  mode: 'SAME_DAY' | 'PRE_ORDER',
): EligibilityResult {
  const rejected = items
    .filter((it) => !it.is_available || (mode === 'PRE_ORDER' ? !it.preorder_ok : !it.same_day_ok))
    .map((it) => it.name || it.product_id)
  return { ok: rejected.length === 0, rejected }
}

// ---------- Customer (published rows only — anon-safe via 056 policy) ----------

export async function getPublishedScheduleForDate(scheduledDate: string): Promise<MenuScheduleRow[]> {
  const { data, error } = await supabase.from('menu_schedule').select('*').eq('scheduled_date', scheduledDate).eq('is_published', true)
  if (error) { console.error('[getPublishedScheduleForDate] Error:', error); return [] }
  return (data || []) as MenuScheduleRow[]
}

// ---------- Display mirror (NOT authority — server gate re-decides) ----------
// Mirrors migration 039 trg_menu_gate + 025 mode gate so the customer never
// sees "open" when the order RPC would reject with a schedule rule.

export interface CartMirrorItem {
  product_id: string
  quantity: number
}

export interface ScheduleGateResult {
  allowed: boolean
  rejected?: { product_id: string; code: 'ERR_PRODUCT_NOT_ON_MENU' | 'ERR_PRODUCT_UNAVAILABLE' | 'ERR_PRODUCT_MODE_NOT_ALLOWED' }[]
}

/**
 * Mirror of the server PRE_ORDER schedule gate for a cart on a chosen date/round.
 * - date has NO published schedule → allowed (039: existing available_preorder gate)
 * - date HAS a published schedule → every product must be on it
 *   (round key NULL = all rounds, or matching the selected round's key/name)
 * Server remains authoritative — this only prevents showing "open" when the
 * RPC would reject with ERR_PRODUCT_NOT_ON_MENU.
 */
export function mirrorPreOrderScheduleGate(
  cartItems: CartMirrorItem[],
  scheduledDate: string,
  scheduleRows: MenuScheduleRow[],
  selectedRoundKey?: string | null,
  roundName?: string | null,
): ScheduleGateResult {
  const published = scheduleRows.filter((r) => r.scheduled_date === scheduledDate && r.is_published)
  if (published.length === 0) return { allowed: true }
  const rejected: ScheduleGateResult['rejected'] = []
  for (const it of cartItems) {
    const onMenu = published.some(
      (r) =>
        r.product_id === it.product_id &&
        (r.delivery_round_key == null || r.delivery_round_key === '' ||
          r.delivery_round_key === selectedRoundKey || r.delivery_round_key === roundName),
    )
    if (!onMenu) rejected.push({ product_id: it.product_id, code: 'ERR_PRODUCT_NOT_ON_MENU' })
  }
  return rejected.length === 0 ? { allowed: true } : { allowed: false, rejected }
}
