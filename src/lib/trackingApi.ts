// ============================================
// Bite Me Baby — Secure Anonymous Order Tracking (W5-1 / migration 050)
// ============================================
// After W5-H1, anonymous visitors can NO LONGER SELECT `orders` directly
// (migration 050 drops `orders_anon_read`). Guest tracking goes through the
// minimal secure RPC `track_order(p_order_number, p_phone)` which returns
// ONLY tracking-scope fields (no customer_name / phone / address / coords /
// payment-sensitive / internal fields) and enforces rate limiting
// (5 failed attempts / 15 min per phone) + anti-enumeration
// (wrong number / wrong phone / nonexistent → identical {"found": false}).
//
// Authenticated owners keep the direct RLS read path (`orders_own_read`,
// customer_ref = auth.uid()) — this module is only the fallback/guest path.
// ============================================

import { supabase } from './supabase'
import type { OrderForm } from './bmbAdminApi_orders'

const TRACK_PHONE_KEY = 'bmb_track_phone'

/** Phone entered for guest tracking (kept locally so polling doesn't re-ask). */
export function getSavedTrackPhone(): string {
  try {
    return String(localStorage.getItem(TRACK_PHONE_KEY) || '')
  } catch {
    return ''
  }
}

export function saveTrackPhone(phone: string): void {
  try {
    localStorage.setItem(TRACK_PHONE_KEY, phone)
  } catch {
    /* storage unavailable — tracking still works per-call */
  }
}

/**
 * Guest tracking read path (migration 050 RPC). Returns an OrderForm-shaped
 * object containing tracking-scope fields only, or null when the pair
 * (order_number, phone) does not match / is rate-limited (server returns
 * the same `found:false` shape for both — no enumeration oracle).
 */
export async function trackOrderByPhone(
  orderNumber: string,
  phone: string,
): Promise<OrderForm | null> {
  if (!orderNumber || !phone) return null
  const { data, error } = await supabase.rpc('track_order', {
    p_order_number: orderNumber,
    p_phone: phone,
  })
  if (error) return null
  const res = data as { found?: boolean; order?: Record<string, any>; items?: any[] } | null
  if (!res?.found || !res?.order) return null
  const o = { ...res.order, items: res.items ?? [] } as unknown as OrderForm
  saveTrackPhone(phone)
  return o
}
