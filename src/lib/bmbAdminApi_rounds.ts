// ============================================
// Bite Me Baby Admin API — Delivery Rounds + Capacity (D8/D9 gap)
// Phase D: DB-backed management of `delivery_rounds` (admin RLS).
// ============================================

import { supabase } from './supabase'

export interface DeliveryRoundRow {
  id: string
  round_key: string
  display_name: string
  cutoff_time: string
  delivery_start: string
  delivery_end: string
  max_capacity: number
  current_count: number
  scheduled_date: string
  status: string
  created_at?: string
  updated_at?: string
}

export async function getDeliveryRoundsAdmin(): Promise<DeliveryRoundRow[]> {
  const { data, error } = await supabase.from('delivery_rounds').select('*').order('scheduled_date', { ascending: true })
  if (error) { console.error('[getDeliveryRoundsAdmin] Error:', error); return [] }
  return (data || []) as DeliveryRoundRow[]
}

export async function upsertDeliveryRound(row: DeliveryRoundRow): Promise<DeliveryRoundRow | null> {
  const now = new Date().toISOString()
  const payload = { ...row, updated_at: now }

  if (row.id) {
    const { data, error } = await supabase.from('delivery_rounds').update(payload).eq('id', row.id).select().single()
    if (error) { console.error('[upsertDeliveryRound] update error:', error); return null }
    return data as DeliveryRoundRow
  }

  // max_capacity is guarded by the RPC create_order_with_items (capacity check);
  // creation uses the seeded round_key pattern.
  const id = row.id || `round-${Date.now()}`
  const { data, error } = await supabase
    .from('delivery_rounds')
    .insert({ ...payload, id, current_count: 0, created_at: now })
    .select()
    .single()
  if (error) { console.error('[upsertDeliveryRound] insert error:', error); return null }
  return data as DeliveryRoundRow
}

export async function setRoundStatus(id: string, status: string): Promise<boolean> {
  const { error } = await supabase.from('delivery_rounds').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[setRoundStatus] Error:', error); return false }
  return true
}

/** Reset capacity counters for the next day (admin-only maintenance tool). */
export async function resetRoundCapacity(id: string): Promise<boolean> {
  const { error } = await supabase.from('delivery_rounds').update({ current_count: 0, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[resetRoundCapacity] Error:', error); return false }
  return true
}

// ============================================
// ✅ Phase 3B (migration 024/025/029): canonical round reading for the customer
// checkout — deterministic ids `round-YYYYMMDD-<key>`, template-validated,
// instantiated server-side by ensure_rounds_for_date (EXECUTE granted to
// authenticated by migration 029). The SERVER remains the round authority;
// these helpers only display what the server will accept.
// ============================================

/** Instantiate (idempotently) the canonical rounds of a date. Graceful when the
 * RPC is unavailable: falls back to listing whatever active rounds already exist. */
export async function ensureRoundsForDate(date: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('ensure_rounds_for_date', { p_date: date })
    if (error) {
      console.warn('[ensureRoundsForDate] RPC unavailable/failed (continuing with existing rounds):', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[ensureRoundsForDate] unexpected error:', String(e).slice(0, 120))
    return false
  }
}

/** Active (bookable) rounds for a date — only `status='active'` rows can be used
 * by the canonical create RPC (025: anything else → ERR_ROUND_CLOSED). */
export async function getActiveRoundsForDate(date: string): Promise<DeliveryRoundRow[]> {
  const { data, error } = await supabase
    .from('delivery_rounds')
    .select('*')
    .eq('scheduled_date', date)
    .order('delivery_start', { ascending: true })
  if (error) { console.error('[getActiveRoundsForDate] Error:', error); return [] }
  return ((data || []) as DeliveryRoundRow[]).filter((r) => r.status === 'active')
}

/** Convenience: instantiate then list (SAME_DAY today + PRE_ORDER date picker). */
export async function listRoundsForDate(date: string): Promise<DeliveryRoundRow[]> {
  await ensureRoundsForDate(date)
  return getActiveRoundsForDate(date)
}