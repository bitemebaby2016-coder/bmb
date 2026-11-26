// ============================================
// Bite Me Baby Admin API - Price History + PO Dashboard (Phase 2 WP7/WP8)
// DB-backed via SECURITY INVOKER RPC (migrations 227/228) — RLS enforced.
// No mock/stub.
// ============================================

import { supabase } from './supabase'
import type { PurchasePriceHistory, PODashboard, PriceType } from '@/types'

export type { PurchasePriceHistory, PODashboard, PriceType }

export interface PriceHistoryFilter {
  ingredientId?: string | null
  supplierId?: string | null
  priceType?: PriceType | null
  dateFrom?: string | null
  dateTo?: string | null
  limit?: number
  offset?: number
}

export async function getPurchasePriceHistory(filter: PriceHistoryFilter = {}): Promise<PurchasePriceHistory[]> {
  const { data, error } = await supabase.rpc('get_purchase_price_history', {
    p_ingredient_id: filter.ingredientId ?? null,
    p_supplier_id: filter.supplierId ?? null,
    p_price_type: filter.priceType ?? null,
    p_date_from: filter.dateFrom ?? null,
    p_date_to: filter.dateTo ?? null,
    p_limit: filter.limit ?? 100,
    p_offset: filter.offset ?? 0,
  })
  if (error) { console.error('[getPurchasePriceHistory] Error:', error); return [] }
  return (data || []) as PurchasePriceHistory[]
}

export async function getPoDashboard(params: {
  dateFrom?: string | null
  dateTo?: string | null
  supplierId?: string | null
} = {}): Promise<PODashboard | null> {
  const { data, error } = await supabase.rpc('get_po_dashboard', {
    p_date_from: params.dateFrom ?? null,
    p_date_to: params.dateTo ?? null,
    p_supplier_id: params.supplierId ?? null,
  })
  if (error) { console.error('[getPoDashboard] Error:', error); return null }
  return data as PODashboard
}