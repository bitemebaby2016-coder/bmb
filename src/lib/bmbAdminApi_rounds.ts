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