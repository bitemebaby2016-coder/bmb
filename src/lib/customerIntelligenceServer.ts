// ============================================
// Bite Me Baby — Customer Intelligence (CI-01, migration 022)
// Server-side segmentation from paid orders (view customer_intelligence + RPC).
// ============================================

import { supabase } from './supabase'

export interface CustomerIntelligenceRow {
  user_id: string
  total_orders: number
  total_revenue: number
  average_order_value: number
  days_since_last_order: number | null
  last_order_at: string | null
  segment: 'new' | 'regular' | 'vip'
}

export const SEGMENT_LABEL_TH: Record<CustomerIntelligenceRow['segment'], string> = {
  new: 'ลูกค้าใหม่',
  regular: 'ลูกค้าประจำ',
  vip: 'VIP',
}

/** Server-authoritative per-customer intelligence (own or admin). */
export async function getCustomerIntelligence(userId?: string): Promise<CustomerIntelligenceRow | null> {
  const { data, error } = await supabase.rpc('customer_intelligence', { p_user_id: userId ?? null })
  if (error) return null
  const body = data as unknown as { customer?: Record<string, unknown>; customers?: unknown }
  if (body.customer && Object.keys(body.customer).length > 0) return body.customer as unknown as CustomerIntelligenceRow
  return null
}

/** Admin: full customer list, ranked by revenue. */
export async function listCustomerIntelligence(): Promise<CustomerIntelligenceRow[]> {
  const { data, error } = await supabase.rpc('customer_intelligence', { p_user_id: null })
  if (error) return []
  return (data as unknown as { customers: CustomerIntelligenceRow[] }).customers ?? []
}

/** Pure segmentation snapshot for dashboards (no I/O). */
export function segmentBreakdown(rows: CustomerIntelligenceRow[]): Record<CustomerIntelligenceRow['segment'], number> {
  const out: Record<CustomerIntelligenceRow['segment'], number> = { new: 0, regular: 0, vip: 0 }
  for (const r of rows) out[r.segment] = (out[r.segment] ?? 0) + 1
  return out
}