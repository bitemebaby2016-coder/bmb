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
