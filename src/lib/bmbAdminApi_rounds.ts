// ============================================
// Bite Me Baby Admin API â€” Delivery Rounds + Capacity (D8/D9 gap)
// Phase D: DB-backed management of `delivery_rounds` (admin RLS).
// ============================================

import { supabase } from './supabase'
import { writeAuditLog } from './auditLog'

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

/** R3 (D-05): status whitelist â€” a round is either bookable or closed. */
const ROUND_STATUSES = new Set(['active', 'closed'])

export async function getDeliveryRoundsAdmin(): Promise<DeliveryRoundRow[]> {
  const { data, error } = await supabase.from('delivery_rounds').select('*').order('scheduled_date', { ascending: true })
  // R3 (D-05): à¸«à¹‰à¸²à¸¡à¹€à¸‡à¸µà¸¢à¸š â€” à¹à¸­à¸”à¸¡à¸´à¸™à¹€à¸«à¹‡à¸™à¸£à¸²à¸¢à¸à¸²à¸£à¸§à¹ˆà¸²à¸‡à¸•à¸­à¸™ DB à¸¥à¹ˆà¸¡à¸„à¸·à¸­ "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸²à¸¢" à¸—à¸µà¹ˆà¸­à¸±à¸™à¸•à¸£à¸²à¸¢
  if (error) {
    console.error('[getDeliveryRoundsAdmin] Error:', error)
    throw new Error(`ERR_ROUNDS_READ: ${error.message}`)
  }
  return (data || []) as DeliveryRoundRow[]
}

/**
 * R3 (D-05): template guard â€” a round without cutoff/window/capacity cannot be
 * saved (a half-configured round silently blocks checkout with ERR_ROUND_*).
 * Returns an error message, or null when the row is complete.
 */
export function validateRoundTemplate(row: Partial<DeliveryRoundRow>): string | null {
  if (!String(row.display_name ?? '').trim()) return 'à¸•à¹‰à¸­à¸‡à¸¡à¸µà¸Šà¸·à¹ˆà¸­à¸£à¸­à¸š (display_name)'
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(row.cutoff_time ?? ''))) return 'à¹€à¸§à¸¥à¸²à¸›à¸´à¸”à¸£à¸±à¸š (cutoff_time) à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡'
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(row.delivery_start ?? ''))) return 'à¹€à¸§à¸¥à¸²à¹€à¸£à¸´à¹ˆà¸¡à¸ªà¹ˆà¸‡ (delivery_start) à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡'
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(row.delivery_end ?? ''))) return 'à¹€à¸§à¸¥à¸²à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸ªà¹ˆà¸‡ (delivery_end) à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡'
  const cap = Number(row.max_capacity)
  if (!Number.isFinite(cap) || cap <= 0) return 'max_capacity à¸•à¹‰à¸­à¸‡à¸¡à¸²à¸à¸à¸§à¹ˆà¸² 0'
  return null
}

export async function upsertDeliveryRound(row: DeliveryRoundRow): Promise<DeliveryRoundRow | null> {
  // R3 (D-05): guard à¸à¸±à¸™à¸šà¸±à¸™à¸—à¸¶à¸à¸£à¸­à¸šà¸„à¸£à¸¶à¹ˆà¸‡ à¹† à¸à¸¥à¸²à¸‡ à¹† + audit à¸—à¸¸à¸à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚
  const invalid = validateRoundTemplate(row)
  if (invalid) {
    console.error('[upsertDeliveryRound] template guard:', invalid)
    return null
  }
  const now = new Date().toISOString()
  const payload = { ...row, updated_at: now }

  if (row.id) {
    const { data, error } = await supabase.from('delivery_rounds').update(payload).eq('id', row.id).select().single()
    if (error) { console.error('[upsertDeliveryRound] update error:', error); return null }
    writeAuditLog({
      action: 'settings_change',
      entity_type: 'delivery_round',
      entity_id: row.id,
      description: `à¹à¸à¹‰à¹„à¸‚à¸£à¸­à¸šà¸ªà¹ˆà¸‡ ${row.display_name} (${row.scheduled_date})`,
      metadata: { cutoff_time: row.cutoff_time, delivery_start: row.delivery_start, delivery_end: row.delivery_end, max_capacity: row.max_capacity, status: row.status },
    })
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
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `à¸ªà¸£à¹‰à¸²à¸‡à¸£à¸­à¸šà¸ªà¹ˆà¸‡ ${row.display_name} (${row.scheduled_date})`,
    metadata: { status: row.status, max_capacity: row.max_capacity },
  })
  return data as DeliveryRoundRow
}

export async function setRoundStatus(id: string, status: string): Promise<boolean> {
  // R3 (D-05): whitelist + audit â€” à¹ƒà¸„à¸£à¹€à¸›à¸´à¸”/à¸›à¸´à¸”à¸£à¸­à¸š à¸•à¹‰à¸­à¸‡à¸ªà¸­à¸šà¸¢à¹‰à¸­à¸™à¸«à¸¥à¸±à¸‡à¹„à¸”à¹‰à¹€à¸ªà¸¡à¸­
  if (!ROUND_STATUSES.has(status)) {
    console.error('[setRoundStatus] invalid status:', status)
    return false
  }
  const { data: before, error: readErr } = await supabase
    .from('delivery_rounds')
    .select('status, display_name, scheduled_date')
    .eq('id', id)
    .maybeSingle()
  if (readErr) { console.error('[setRoundStatus] read error:', readErr); return false }
  const { error } = await supabase.from('delivery_rounds').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[setRoundStatus] Error:', error); return false }
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `à¸£à¸­à¸šà¸ªà¹ˆà¸‡ "${before?.display_name ?? id}" (${before?.scheduled_date ?? '?'}) : ${before?.status ?? '?'} â†’ ${status}`,
    metadata: { from: before?.status ?? null, to: status },
  })
  return true
}

/** Reset capacity counters for the next day (admin-only maintenance tool). */
export async function resetRoundCapacity(id: string): Promise<boolean> {
  const { error } = await supabase.from('delivery_rounds').update({ current_count: 0, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[resetRoundCapacity] Error:', error); return false }
  writeAuditLog({
    action: 'settings_change',
    entity_type: 'delivery_round',
    entity_id: id,
    description: `à¸£à¸µà¹€à¸‹à¹‡à¸•à¸ˆà¸³à¸™à¸§à¸™à¸—à¸µà¹ˆà¸£à¸±à¸šà¹„à¸§à¹‰à¸‚à¸­à¸‡à¸£à¸­à¸š ${id} à¹€à¸›à¹‡à¸™ 0`,
    metadata: { current_count: 0 },
  })
  return true
}

// ============================================
// âœ… Phase 3B (migration 024/025/029): canonical round reading for the customer
// checkout â€” deterministic ids `round-YYYYMMDD-<key>`, template-validated,
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

/** Active (bookable) rounds for a date â€” only `status='active'` rows can be used
 * by the canonical create RPC (025: anything else â†’ ERR_ROUND_CLOSED). */
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

/** ALL rounds of a date (admin â€” includes closed ones so the schedule admin can
 *  show a per-round open/close switch; customer checkout keeps listRoundsForDate
 *  = active only, create RPC is still the only authority). */
export async function getRoundsForDateAdmin(date: string): Promise<DeliveryRoundRow[]> {
  const { data, error } = await supabase
    .from('delivery_rounds')
    .select('*')
    .eq('scheduled_date', date)
    .order('delivery_start', { ascending: true })
  if (error) { console.error('[getRoundsForDateAdmin] Error:', error); return [] }
  return (data || []) as DeliveryRoundRow[]
}