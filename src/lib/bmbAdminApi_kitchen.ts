// ============================================
// Bite Me Baby Admin API — Kitchen & Production
// ============================================

import { supabase } from './supabase'

export interface KitchenSummaryItem {
  batch_id: string
  delivery_round_id: string | null
  scheduled_date: string
  status: string
  total_items: number
  ready_items: number
  pending_items: number
}

export interface KitchenQueueResponse {
  ok: boolean
  date: string
  total_batches: number
  batches: KitchenSummaryItem[]
  summary: { pending_orders: number; ready_orders: number }
}

/** Get today's kitchen production summary */
export async function getKitchenSummary(date?: string): Promise<KitchenQueueResponse | null> {
  const { data, error } = await supabase.rpc('get_kitchen_summary', { p_date: date || new Date().toISOString().split('T')[0] })
  if (error) { console.error('[Kitchen] getKitchenSummary failed:', error); return null }
  return data as unknown as KitchenQueueResponse
}

/** List all production batches with their items */
export async function listBatches(date?: string, roundId?: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('kitchen_queue', {
    p_delivery_round_id: roundId ?? null,
    p_scheduled_date: date ?? new Date().toISOString().split('T')[0]
  })
  if (error) { console.error('[Kitchen] listBatches failed:', error); return [] }
  return (data as any)?.batches ?? []
}

/** Create a production batch via RPC */
export async function createBatch(roundId: string, scheduledDate?: string, orderMode?: string): Promise<{ batch_id: string; items_count: number } | null> {
  const { data, error } = await supabase.rpc('create_production_batch', {
    p_delivery_round_id: roundId,
    p_scheduled_date: scheduledDate ?? null,
    p_order_mode: orderMode ?? null
  })
  if (error) { console.error('[Kitchen] createBatch failed:', error); return null }
  return data as unknown as { batch_id: string; items_count: number }
}

