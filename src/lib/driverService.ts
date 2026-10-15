// ============================================
// Bite Me Baby — Driver / Delivery assignment service (DEL-02 + F-06 WAVE 2-B)
// Identity = Supabase Auth JWT ONLY (Owner Decision 06).
// All RPCs resolve the driver via auth.uid() → drivers.user_id —
// phone/name/driver_id from the client are NOT trusted (F-06 fix, migr 041).
// ============================================

import { supabase } from './supabase'

export interface DriverRecord {
  id: string
  name: string
  phone: string
  vehicle_label: string
  status: 'available' | 'busy' | 'offline'
  current_latitude: number | null
  current_longitude: number | null
  last_seen_at: string | null
  tenant_id: string              // TEN-02: FK to tenants(id)
  home_branch_id: string         // TEN-07: FK to branches(id) — driver's home branch
  can_float: boolean             // TEN-07: can be assigned to other branches in tenant
  branch_id: string              // TEN-07: current branch context (alias for home_branch_id)
}

export interface MyDeliveryItem {
  product_name: string
  quantity: number
}

export interface MyDeliveryAssignment {
  order_number: string
  assignment_status: 'assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered'
  assigned_at: string
  accepted_at: string | null
  dropoff_detail: string
  dropoff_latitude: number | null
  dropoff_longitude: number | null
  order_status: string
  total_amount: number
  payment_status: string
  payment_method: string
  items: MyDeliveryItem[]
}

/**
 * F-06: JWT-bound driver login. Requires an active Supabase Auth session whose
 * user is linked to a drivers row (admin provisioning). Phone-only login is
 * no longer possible.
 */
export async function driverLogin(): Promise<DriverRecord | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data, error } = await supabase.rpc('driver_login')
  if (error) {
    console.warn('[Driver] driver_login failed:', error.message)
    return null
  }
  return (data as unknown as { driver: DriverRecord }).driver ?? null
}

export async function myDeliveries(): Promise<MyDeliveryAssignment[]> {
  const { data, error } = await supabase.rpc('my_deliveries')
  if (error) {
    console.warn('[Driver] my_deliveries failed:', error.message)
    return []
  }
  return (data as unknown as { assignments: MyDeliveryAssignment[] }).assignments ?? []
}

export async function driverAcceptAssignment(orderNumber: string): Promise<boolean> {
  const { error } = await supabase.rpc('driver_accept_assignment', { p_order_number: orderNumber })
  return !error
}

export async function driverUpdateDeliveryStatus(
  orderNumber: string,
  status: 'picked_up' | 'in_transit' | 'delivered',
  coords?: { latitude: number; longitude: number },
): Promise<boolean> {
  // p_driver_phone is REQUIRED by the 041 signature but IGNORED for identity
  // (JWT WINS, F-06) — sent as empty string for wire compatibility only.
  const { error } = await supabase.rpc('driver_update_delivery_status', {
    p_order_number: orderNumber,
    p_driver_phone: '',
    p_status: status,
    p_latitude: coords?.latitude ?? null,
    p_longitude: coords?.longitude ?? null,
  })
  return !error
}

/** Admin: assign an order to a driver (dispatch board). */
export async function assignDriver(orderNumber: string, driverId: string): Promise<boolean> {
  const { error } = await supabase.rpc('assign_driver', { p_order_number: orderNumber, p_driver_id: driverId })
  return !error
}

// ============================================
// GAP A-1 (migration 116) — admin closes the delivery loop.
//
// The rider PWA owns the day-to-day advance (picked_up/in_transit/delivered)
// and keeps its stricter geolocation+POD gate. This admin path exists for when
// the rider cannot tap (device/app failure): it reuses the SAME forward-only
// hop rules and writes an audit trail tagged 'admin_advance_delivery_status'.
// It is an override, not a second rider.
// ============================================
export async function adminAdvanceDelivery(
  orderNumber: string,
  status: 'picked_up' | 'in_transit' | 'delivered',
): Promise<{ ok: boolean; error?: string; order_status?: string; driver_released?: boolean }> {
  const { data, error } = await supabase.rpc('admin_advance_delivery_status', {
    p_order_number: orderNumber,
    p_status: status,
  })
  if (error) return { ok: false, error: error.message }
  const res = data as { ok?: boolean; order_status?: string; driver_released?: boolean } | null
  if (!res || res.ok !== true) return { ok: false, error: 'ERR_ADVANCE_REJECTED' }
  return { ok: true, order_status: res.order_status, driver_released: res.driver_released === true }
}

/**
 * Admin provisioning (Owner Decision 06): link an existing Supabase Auth user
 * to a driver record. The auth user must be created via Supabase Dashboard /
 * Admin API first (no SMS OTP infrastructure — reported gap, Wave 2 report).
 * Returns a detailed result so the Admin UI can surface server errors
 * (ERR_USER_NOT_FOUND / ERR_USER_ALREADY_LINKED / ERR_DRIVER_NOT_FOUND).
 */
export async function linkDriverUser(driverId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('link_driver_user', { p_driver_id: driverId, p_user_id: userId })
  if (error) return { ok: false, error: error.message }
  const res = data as { ok?: boolean } | null
  return { ok: res?.ok === true, error: res?.ok === true ? undefined : 'ERR_LINK_REJECTED' }
}

/**
 * Admin provisioning (Owner Decision 06): create/update a driver record.
 * NOTE: upsert_driver is keyed by PHONE (ON CONFLICT (phone) DO UPDATE) —
 * re-submitting an existing phone updates that driver instead of duplicating.
 * Returns a detailed result so the Admin UI can surface server errors
 * (ERR_MISSING_DRIVER_INFO / ERR_FORBIDDEN).
 */
export async function upsertDriver(
  name: string,
  phone: string,
  vehicleLabel = '',
): Promise<{ ok: boolean; driver_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('upsert_driver', { p_name: name, p_phone: phone, p_vehicle_label: vehicleLabel })
  if (error) return { ok: false, error: error.message }
  const res = data as { ok?: boolean; driver_id?: string } | null
  if (!res?.ok || !res.driver_id) return { ok: false, error: 'ERR_UPSERT_REJECTED' }
  return { ok: true, driver_id: res.driver_id }
}

/**
 * Admin provisioning: read driver rows (id/name/user_id/status) so the UI can
 * show which drivers are linked to a login account. READ-ONLY via RLS
 * (is_admin) — same pattern as the customers photo lookup on the board.
 */
export interface DriverAccountRow {
  id: string
  name: string
  user_id: string | null
  status: string
}

export async function getDriverAccounts(): Promise<DriverAccountRow[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, name, user_id, status')
  if (error) { console.error('[Driver] drivers read failed:', error); return [] }
  return (data ?? []) as DriverAccountRow[]
}

// ============================================
// STEP 3B-2D — Admin dispatch board (canonical reads only)
// ============================================
export interface AdminDriverRow {
  id: string
  driver_name: string
  phone_number: string
  status: string
  max_capacity: number | null
  current_latitude: number | null
  current_longitude: number | null
  active_assignments: number
  last_active: string | null
}

/** Admin driver list via canonical RPC `list_drivers` (037; is_admin-guarded). */
export async function adminListDrivers(): Promise<{ ok: boolean; drivers: AdminDriverRow[] }> {
  const { data, error } = await supabase.rpc('list_drivers')
  if (error) { console.error('[Driver] list_drivers failed:', error); return { ok: false, drivers: [] } }
  const d = data as unknown as { ok?: boolean; drivers?: AdminDriverRow[] }
  return { ok: !!d?.ok, drivers: d?.drivers ?? [] }
}

// ============================================
// ข้อความแจ้งเตือนเป็นภาษาไทยสำหรับแอดมิน (ไม่แสดงรหัสระบบ)
// ============================================
const DRIVER_ERROR_TH: Record<string, string> = {
  ERR_MISSING_DRIVER_INFO: 'กรอกข้อมูลไม่ครบ — ต้องมีชื่อและเบอร์โทร',
  ERR_MISSING_ASSIGNMENT: 'เลือกออเดอร์และไรเดอร์ให้ครบก่อนมอบหมาย',
  ERR_FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิ์จัดการไรเดอร์',
  ERR_NOT_AUTHENTICATED: 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่',
  ERR_DRIVER_NOT_FOUND: 'ไม่พบไรเดอร์ที่เลือก',
  ERR_ORDER_NOT_FOUND: 'ไม่พบออเดอร์นี้',
  ERR_ORDER_NOT_DISPATCHABLE: 'ออเดอร์นี้ยังไม่อยู่ในสถานะพร้อมส่ง',
  ERR_BRANCH_UNAVAILABLE: 'ยังไม่มีสาขาของร้าน — ตั้งค่าสาขาในระบบก่อน',
  ERR_USER_NOT_FOUND: 'ไม่พบบัญชีผู้ใช้นี้',
  ERR_USER_ALREADY_LINKED: 'บัญชีนี้ถูกผูกกับไรเดอร์คนอื่นแล้ว',
  ERR_UPSERT_REJECTED: 'บันทึกไม่สำเร็จ — ตรวจสอบข้อมูลแล้วลองใหม่',
  ERR_LINK_REJECTED: 'ผูกบัญชีไม่สำเร็จ — ลองใหม่อีกครั้ง',
  ERR_ADVANCE_REJECTED: 'เดินหน้าสถานะไม่สำเร็จ — ออเดอร์อาจอยู่ในสถานะที่ไม่รองรับ',
}

/** แปลงรหัส error / ข้อความจากฐานข้อมูล เป็นภาษาไทยที่คนอ่านเข้าใจ */
export function driverErrorText(raw: unknown): string {
  const s = String(raw ?? '')
  for (const code of Object.keys(DRIVER_ERROR_TH)) {
    if (s.includes(code)) return DRIVER_ERROR_TH[code]
  }
  if (s.includes('23502') || s.toLowerCase().includes('null value')) {
    return 'ข้อมูลสาขาของร้านยังไม่สมบูรณ์ — ตั้งค่าสาขาในระบบก่อน'
  }
  if (s.includes('23505') || s.toLowerCase().includes('duplicate')) {
    return 'มีข้อมูลนี้อยู่แล้วในระบบ'
  }
  if (s.trim() === '') return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
  return s.length > 90 ? s.slice(0, 90) + '…' : s
}
