// ============================================
// Bite Me Baby — R21f (Owner 2026-10-29): ตำแหน่งไรเดอร์ของออเดอร์ (หน้าลูกค้า)
// ============================================
// ผ่าน RPC order_rider_position (m174) — SECURITY DEFINER ตรวจสิทธิ์เอง:
//   คืน null เมื่อไม่ใช่เจ้าของ/ไม่มี assignment/ยังไม่มีพิกัด (อ่านปลอดภัยทุก call)
// หน้าที่: OrderTrackPage ดึงทุก ~12 วิ ระหว่าง dispatched → arrived
// ============================================

import { supabase } from './supabase'

export interface RiderPosition {
  latitude: number
  longitude: number
  /** เวลาที่ไรเดอร์ส่งพิกัดล่าสุด (null = ไม่ทราบ) */
  updated_at?: string | null
  driver_id?: string
}

export async function getOrderRiderPosition(orderNumber: string): Promise<RiderPosition | null> {
  if (!orderNumber) return null
  try {
    const { data, error } = await supabase.rpc('order_rider_position', { p_order_number: orderNumber })
    if (error) {
      // RPC ยังไม่ถูก apply (m174) / สิทธิ์ไม่ผ่าน = เงียบ — หน้า track ต้องไม่พัง
      console.error('[getOrderRiderPosition] rpc error:', error.message)
      return null
    }
    const v = data as { latitude?: number | string; longitude?: number | string; updated_at?: string | null; driver_id?: string } | null
    if (!v || v.latitude == null || v.longitude == null) return null
    const latitude = Number(v.latitude)
    const longitude = Number(v.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return { latitude, longitude, updated_at: v.updated_at ?? null, driver_id: v.driver_id }
  } catch (e) {
    console.error('[getOrderRiderPosition] failed:', String(e).slice(0, 120))
    return null
  }
}
