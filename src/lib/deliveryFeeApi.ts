// ============================================
// Bite Me Baby — Authoritative delivery fee API (DEL-01)
// Server fee comes from delivery_zones via compute_delivery_fee_rpc (migration 020).
// The pure mirror exists so UI can render an identical fee even when offline
// (zone rows mirrored from the seeded delivery_zones table).
// ============================================

import { supabase } from './supabase'
import { haversineDistanceKm } from './deliveryRouter'
import { KITCHEN_POINT } from '@/config/kitchenLocation'

export interface DeliveryZonesRow {
  id: string
  name: string
  min_distance_km: number
  max_distance_km: number
  fee: number
  is_active: boolean
  branch_id: string          // TEN-07: FK to branches(id) — zone belongs to a branch
  tenant_id: string          // TEN-02: FK to tenants(id)
}

// Offline DISPLAY mirror of the seeded zone rows — used only by offline math and
// tests (deliveryFeeApi.test.ts). NEVER a checkout/order fallback: the server RPC
// is the single authority and its failure is surfaced as an explicit error state.
// NOTE: admin edits land in `delivery_zones` (AdminSettings) — this mirror can
// drift from the live table and must not be presented as the admin-set fee.
export const SEEDED_DELIVERY_ZONES: DeliveryZonesRow[] = [
  { id: 'zone-city', name: 'ในเมือง', min_distance_km: 0, max_distance_km: 5, fee: 25, is_active: true, branch_id: 'branch-bite-me-baby-main', tenant_id: 'tenant-bmb-001' },
  { id: 'zone-suburb', name: 'ชานเมือง', min_distance_km: 5, max_distance_km: 10, fee: 45, is_active: true, branch_id: 'branch-bite-me-baby-main', tenant_id: 'tenant-bmb-001' },
  { id: 'zone-far', name: 'ไกล', min_distance_km: 10, max_distance_km: 20, fee: 80, is_active: true, branch_id: 'branch-bite-me-baby-main', tenant_id: 'tenant-bmb-001' },
]

/** Pure: pick the zone that contains `distanceKm` and return its flat fee. */
export function zoneFeeForDistance(distanceKm: number, zones: DeliveryZonesRow[] = SEEDED_DELIVERY_ZONES): number | null {
  const zone = zones
    .filter((z) => z.is_active && distanceKm >= z.min_distance_km && distanceKm <= z.max_distance_km)
    .sort((a, b) => a.max_distance_km - b.max_distance_km)[0]
  return zone ? zone.fee : null
}

/** Server-authoritative fee quote (migration 020 RPC). Falls back to local mirror. */
export interface DeliveryFeeQuote {
  /** null = could NOT be computed (error) — callers must NOT present it as a valid fee. */
  delivery_fee: number | null
  source: 'server' | 'local-mirror' | 'error'
}

export async function fetchServerDeliveryFee(params: {
  dropoffLatitude: number | null
  dropoffLongitude: number | null
  deliveryMethod?: string
  itemsCount?: number
  distanceKm?: number | null
  kitchen?: { latitude: number; longitude: number }
}): Promise<DeliveryFeeQuote> {
  try {
    const { data, error } = await supabase.rpc('compute_delivery_fee_rpc', {
      p_dropoff_latitude: params.dropoffLatitude ?? null,
      p_dropoff_longitude: params.dropoffLongitude ?? null,
      p_delivery_method: params.deliveryMethod ?? 'self_delivery',
      p_items_count: params.itemsCount ?? 1,
      p_distance_km: params.distanceKm ?? null,
    })
    if (!error && data && typeof (data as { delivery_fee: number }).delivery_fee === 'number') {
      return { delivery_fee: (data as { delivery_fee: number }).delivery_fee, source: 'server' }
    }
    // CR-2 P2: an RPC rejection (e.g. out-of-area guard) or malformed response is
    // NOT a zero fee — surface an explicit error state instead of a silent mirror
    // value that the UI could present as a computed price.
    console.warn('[DeliveryFee] server quote rejected:', error?.message ?? 'malformed response')
    return { delivery_fee: null, source: 'error' }
  } catch (e) {
    console.warn('[DeliveryFee] server quote unavailable:', String(e).slice(0, 100))
    return { delivery_fee: null, source: 'error' }
  }
}

/** Pure: how the checkout should present a fee quote. Exported for tests. */
export function feeUiState(
  quote: { delivery_fee: number | null; source: 'server' | 'local-mirror' | 'error' },
): { label: string; detail: string; tone: 'ok' | 'error' } {
  if (quote.source === 'error' || quote.delivery_fee == null) {
    return {
      label: 'ยังคำนวณไม่สำเร็จ',
      detail: 'ระบบยังคำนวณค่าจัดส่งไม่ได้ — กดคำนวณใหม่ หรือสั่งซื้อได้ เซิร์ฟเวอร์จะตรวจค่าจัดส่งอีกครั้งตอนสร้างออเดอร์',
      tone: 'error',
    }
  }
  return {
    label: `${quote.delivery_fee.toFixed(2)} ฿`,
    detail: quote.source === 'server' ? 'คำนวณจากเซิร์ฟเวอร์' : 'ประมาณการ (ออฟไลน์)',
    tone: 'ok',
  }
}

/**
 * Pure: how the ORDER SUMMARY fee/total lines present the current quote.
 * A3 (2026-10-22) — "ยอดลูกค้า = ค่าที่แอดมินตั้ง": when the quote came from the
 * server zone the fee IS the admin-set value and must not be watered down to
 * "ประมาณการ"; when the quote failed, the summary must NOT present a stale
 * deliveryFee as a computed fact — it says "รอระบบคำนวณ" and marks the total
 * approximate instead (server re-derives at create either way).
 */
export function summaryFeeState(
  quote: { delivery_fee: number | null; source: 'server' | 'local-mirror' | 'error' | null },
  opts?: { pickup?: boolean },
): { feeLabel: string; feeValue: string; totalSuffix: string; exact: boolean } {
  if (opts?.pickup) {
    return { feeLabel: 'ค่าจัดส่ง (รับที่ร้าน — ฟรี)', feeValue: '0.00 บาท', totalSuffix: 'บาท', exact: true }
  }
  if (quote.source === 'server' && quote.delivery_fee != null) {
    return {
      feeLabel: 'ค่าจัดส่ง (ตามโซนที่แอดมินตั้ง)',
      feeValue: `${quote.delivery_fee.toFixed(2)} บาท`,
      totalSuffix: 'บาท',
      exact: true,
    }
  }
  if (quote.source === 'local-mirror' && quote.delivery_fee != null) {
    return {
      feeLabel: 'ค่าจัดส่ง (โดยประมาณ)',
      feeValue: `${quote.delivery_fee.toFixed(2)} บาท`,
      totalSuffix: 'บาท (โดยประมาณ)',
      exact: false,
    }
  }
  return {
    feeLabel: 'ค่าจัดส่ง (รอระบบคำนวณ)',
    feeValue: 'รอระบบคำนวณ',
    totalSuffix: 'บาท (โดยประมาณ — ระบบยืนยันราคาตอนสั่งซื้อ)',
    exact: false,
  }
}

/** Local mirror — identical zone math, no network. */
export function localZoneFee(params: {
  dropoffLatitude?: number | null
  dropoffLongitude?: number | null
  distanceKm?: number | null
  kitchen?: { latitude: number; longitude: number }
}): number {
  const kitchen = params.kitchen ?? KITCHEN_POINT
  const distanceKm =
    params.distanceKm ??
    (params.dropoffLatitude != null && params.dropoffLongitude != null
      ? haversineDistanceKm(kitchen.latitude, kitchen.longitude, params.dropoffLatitude, params.dropoffLongitude)
      : 0)
  return zoneFeeForDistance(distanceKm) ?? 0
}