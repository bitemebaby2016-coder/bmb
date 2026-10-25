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
  /** 'offered' = งานประกาศที่ยังไม่มีใครจอง (E1) — สถานะอื่น = งานของฉัน */
  assignment_status: 'offered' | 'assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'declined' | 'cancelled'
  assigned_at: string
  accepted_at: string | null
  dropoff_detail: string
  dropoff_latitude: number | null
  dropoff_longitude: number | null
  order_status: string
  total_amount: number
  payment_status: string
  payment_method: string
  proof_of_delivery_path?: string | null
  pod_captured_at?: string | null
  items: MyDeliveryItem[]
}

// ============================================
// A5 (2026-10-20): action results แบบมีเหตุผล — เลิกคืน boolean เงียบ ๆ
// kind แยกให้ UI บอกผู้ใช้ถูก: network = ลองใหม่ได้ / permission = เข้าสู่ระบบใหม่
// / state = สถานะงานเปลี่ยนไปแล้ว (refresh) / unknown = ติดต่อแอดมิน
// ============================================
export type DriverActionKind = 'network' | 'permission' | 'state' | 'unknown'
export type DriverActionResult =
  | { ok: true; value?: unknown }
  | { ok: false; error: string; kind: DriverActionKind }

/** แปลง PostgREST error → หมวดที่ UI แสดงผล/ตัดสินใจ retry ได้ */
export function classifyDriverError(raw: unknown): { error: string; kind: DriverActionKind } {
  const s = String((raw as { message?: string })?.message ?? raw ?? '')
  // driverErrorText expects the message STRING (raw object stringifies to [object Object])
  const msg = driverErrorText(s)
  const net =
    typeof navigator !== 'undefined' && navigator.onLine === false
  if (net || /failed to fetch|networkerror|fetch failed|load failed|timeout|timed out/i.test(s)) {
    return { error: 'เครือข่ายขัดข้อง — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', kind: 'network' }
  }
  if (/ERR_NOT_AUTHENTICATED|ERR_FORBIDDEN|ERR_NOT_A_DRIVER|JWT|401|403/i.test(s)) {
    return { error: msg, kind: 'permission' }
  }
  if (/ERR_ASSIGNMENT|ERR_ALREADY_DELIVERED|ERR_POD|ERR_DELIVERY_SYNC_BLOCKED|ERR_INVALID|ERR_ORDER_|ERR_OFFER/i.test(s)) {
    return { error: msg, kind: 'state' }
  }
  return { error: msg, kind: 'unknown' }
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

export async function myDeliveriesResult(): Promise<
  { ok: true; assignments: MyDeliveryAssignment[]; offers: MyDeliveryAssignment[] } | { ok: false; error: string; kind: DriverActionKind }
> {
  const { data, error } = await supabase.rpc('my_deliveries')
  if (error) return { ok: false, ...classifyDriverError(error) }
  return {
    ok: true,
    assignments: (data as unknown as { assignments: MyDeliveryAssignment[] }).assignments ?? [],
    // E1: งานประกาศที่ยังว่าง (135) — ไม่มี key นี้ใน server เก่า = [] (ทนไหว)
    offers: (data as unknown as { offers?: MyDeliveryAssignment[] }).offers ?? [],
  }
}

/** แบบเดิม (คืน array เปล่าเมื่อพัง) — เก็บไว้เพื่อความเข้ากันได้ของ caller เก่า */
export async function myDeliveries(): Promise<MyDeliveryAssignment[]> {
  const r = await myDeliveriesResult()
  if (!r.ok) {
    console.warn('[Driver] my_deliveries failed:', r.error)
    return []
  }
  return r.assignments
}

export async function driverAcceptAssignment(orderNumber: string): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('driver_accept_assignment', { p_order_number: orderNumber })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

export async function driverUpdateDeliveryStatus(
  orderNumber: string,
  status: 'picked_up' | 'in_transit' | 'delivered',
  coords?: { latitude: number; longitude: number },
): Promise<DriverActionResult> {
  // p_driver_phone is REQUIRED by the 041 signature but IGNORED for identity
  // (JWT WINS, F-06) — sent as empty string for wire compatibility only.
  const { error } = await supabase.rpc('driver_update_delivery_status', {
    p_order_number: orderNumber,
    p_driver_phone: '',
    p_status: status,
    p_latitude: coords?.latitude ?? null,
    p_longitude: coords?.longitude ?? null,
  })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

/** A4: ปฏิเสธงาน (ได้เฉพาะสถานะ assigned) — งานคืนสู่แอดมินมอบหมายใหม่ */
export async function driverDeclineAssignment(orderNumber: string, reason: string): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('driver_decline_assignment', {
    p_order_number: orderNumber,
    p_reason: reason,
  })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

// ============================================
// E1 (2026-10-22): โมเดล "ประกาศ-รับงาน" (migration 135)
//   dispatchOrder        — แอดมิน: ส่งออกงาน = ประกาศ+เปิดให้ไรเดอร์ทุกคนรับ
//   claimDispatchOffer   — ไรเดอร์: รับงานประกาศ = จองคนเดียว (atomic, คนแรกได้)
//   driverDeclineOffer   — ไรเดอร์: ไม่รับงานประกาศ (ต่อคน — คนอื่นยังรับได้)
//   adminCancelOffer     — แอดมิน: ยกเลิกประกาศ
// ============================================
export async function dispatchOrder(orderNumber: string): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('dispatch_order', { p_order_number: orderNumber })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

export async function claimDispatchOffer(orderNumber: string): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('claim_dispatch_offer', { p_order_number: orderNumber })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

export async function driverDeclineOffer(orderNumber: string): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('driver_decline_offer', { p_order_number: orderNumber })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

export async function adminCancelOffer(orderNumber: string, reason: string): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('cancel_dispatch_offer', {
    p_order_number: orderNumber,
    p_reason: reason,
  })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

// ============================================
// E3 (2026-10-22): GPS heartbeat + ประวัติเส้นทาง (migration 136)
// ============================================
export async function driverUpdateLocation(
  coords: { latitude: number; longitude: number },
  orderNumber?: string,
): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('driver_update_location', {
    p_latitude: coords.latitude,
    p_longitude: coords.longitude,
    p_order_number: orderNumber ?? null,
  })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

export interface RoutePoint {
  latitude: number
  longitude: number
  recorded_at: string
}

/** ประวัติเส้นทางของงาน (สำหรับแอดมิน — ดูย้อนหลังตอนจบงาน) */
export async function getRouteHistory(orderNumber: string): Promise<RoutePoint[]> {
  const { data, error } = await supabase
    .from('driver_location_history')
    .select('latitude, longitude, recorded_at')
    .eq('order_number', orderNumber)
    .order('recorded_at', { ascending: true })
  if (error) return []
  return (data ?? []) as RoutePoint[]
}

/** A4: แอดมินยกเลิกงานค้าง (เก็บประวัติไว้ — ไม่ลบแถว assignment) */
export async function adminCancelAssignment(orderNumber: string, reason: string): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('admin_cancel_assignment', {
    p_order_number: orderNumber,
    p_reason: reason,
  })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true }
}

/** A3: บันทึก POD reference ฝั่งเซิร์ฟเวอร์ (path ต้องอยู่ในโฟลเดอร์ driver ของตน) */
export async function driverAttachPod(
  orderNumber: string,
  objectPath: string,
  coords?: { latitude: number; longitude: number },
): Promise<DriverActionResult> {
  const { error } = await supabase.rpc('driver_attach_pod', {
    p_order_number: orderNumber,
    p_object_path: objectPath,
    p_latitude: coords?.latitude ?? null,
    p_longitude: coords?.longitude ?? null,
  })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true, value: objectPath }
}

// ============================================
// A3 — POD photo upload (Private bucket `pod-photos`)
// บีบอัดก่อน upload (≤1280px, JPEG q0.8) · ตรวจชนิด/ขนาดไฟล์ · path ใต้
//โฟลเดอร์ driver ของตนเอง (storage policy บังคับซ้ำฝั่งเซิร์ฟเวอร์)
// ============================================
export const POD_MAX_INPUT_BYTES = 15 * 1024 * 1024 // รับเข้าไม่เกิน 15MB (ก่อนบีบ)
export const POD_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  // bucket limit = 5MB

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('ERR_POD_PROCESS_FAILED'))
    img.src = url
  })
}

export async function compressPodImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('ERR_POD_NOT_IMAGE')
  }
  const max = 1280
  // R-08 (D8 2026-10-25): decode แบบจัดการ EXIF ถูกต้องข้ามเบราว์เซอร์ —
  //   createImageBitmap + imageOrientation:'from-image' ก่อน (หมุนรูปตาม EXIF เสมอ
  //   = แก้รูปหัว/กลับด้านบางเบราว์เซอร์) · เบราว์เซอร์ที่ไม่รองรับ/decode ไม่ได้
  //   = fallback Image() เดิม · กัน canvas 0×0 (รูปว่าง) เหมือนฝั่งกล้อง
  let width = 0
  let height = 0
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  let objectUrl: string | null = null
  let bitmap: ImageBitmap | null = null
  let imgEl: HTMLImageElement | null = null
  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch { bitmap = null }
  }
  if (bitmap) {
    width = bitmap.width; height = bitmap.height
    draw = (ctx, w, h) => { ctx.drawImage(bitmap!, 0, 0, w, h); bitmap!.close() }
  } else {
    objectUrl = URL.createObjectURL(file)
    imgEl = await loadImageElement(objectUrl)
    width = imgEl.width; height = imgEl.height
    draw = (ctx, w, h) => { ctx.drawImage(imgEl!, 0, 0, w, h) }
  }
  try {
    if (width < 2 || height < 2) throw new Error('ERR_POD_PROCESS_FAILED')
    const scale = Math.min(1, max / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ERR_POD_PROCESS_FAILED')
    draw(ctx, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob) throw new Error('ERR_POD_PROCESS_FAILED')
    return blob
  } catch (e) {
    throw e instanceof Error ? e : new Error('ERR_POD_PROCESS_FAILED')
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

export async function uploadPodPhoto(
  file: File,
  driverId: string,
  orderNumber: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string; kind: DriverActionKind }> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'ไฟล์ต้องเป็นรูปภาพ (JPG/PNG/WebP)', kind: 'state' }
  }
  if (file.size > POD_MAX_INPUT_BYTES) {
    return { ok: false, error: 'ไฟล์ใหญ่เกิน 15MB — ถ่ายใหม่หรือเลือกรูปที่เล็กกว่า', kind: 'state' }
  }
  if (!driverId || !orderNumber) {
    return { ok: false, error: 'ข้อมูลงานไม่ครบ — รีเฟรชหน้าแล้วลองใหม่', kind: 'state' }
  }
  // R3 (D-02): normalize path — โฟลเดอร์ต้องเป็น drivers.id ดิบ (ห้ามมี '/' กัน
  // หลุดโฟลเดอร์) + ชื่อไฟล์ sanitize · policy 139 เทียบโฟลเดอร์แบบทน %20 encoding
  // (storage-js encodeURIComponent) แล้ว — ห้าม rename drivers.id ใน production
  const folder = String(driverId).trim()
  if (!folder || folder.includes('/') || folder.includes('\\')) {
    return { ok: false, error: 'ข้อมูลงานไม่ครบ — รีเฟรชหน้าแล้วลองใหม่', kind: 'state' }
  }
  const safeOrder = String(orderNumber).replace(/[^A-Za-z0-9_-]/g, '')
  if (!safeOrder) {
    return { ok: false, error: 'ข้อมูลงานไม่ครบ — รีเฟรชหน้าแล้วลองใหม่', kind: 'state' }
  }
  let blob: Blob
  try {
    blob = await compressPodImage(file)
  } catch (e) {
    return { ok: false, error: 'อ่านรูปไม่สำเร็จ — ถ่ายใหม่อีกครั้ง', kind: 'state' }
  }
  if (blob.size > POD_MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'รูปหลังบีบอัดยังใหญ่เกิน 5MB — ถ่ายใหม่อีกครั้ง', kind: 'state' }
  }
  const path = `${folder}/${safeOrder}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('pod-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) return { ok: false, ...classifyDriverError(error) }
  return { ok: true, path }
}

/** ฝั่งแอดมิน: ขอ signed URL ชั่วคราวเพื่อแสดงรูป POD (bucket ส่วนตัว) */
export async function getPodSignedUrl(path: string, expiresSec = 3600): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('pod-photos').createSignedUrl(path, expiresSec)
  if (error) {
    console.warn('[Driver] POD signed url failed:', error.message)
    return null
  }
  return data?.signedUrl ?? null
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
  ERR_POD_REQUIRED: 'ต้องแนบรูปส่งมอบ (POD) ก่อนยืนยันส่งสำเร็จ',
  ERR_POD_MISSING: 'ยังไม่มีรูปส่งมอบ — ถ่ายรูปก่อนยืนยัน',
  ERR_POD_PATH_FORBIDDEN: 'ไฟล์รูปไม่ได้อยู่ในโฟลเดอร์ของไรเดอร์คนนี้',
  ERR_ASSIGNMENT_NOT_FOUND: 'ไม่พบงานนี้ของคุณ — อาจถูกยกเลิกหรือส่งต่อแล้ว รีเฟรชรายการงาน',
  ERR_ASSIGNMENT_NOT_ACCEPTABLE: 'งานนี้เปลี่ยนสถานะแล้ว รับ/ปฏิเสธไม่ได้ — รีเฟรชรายการงาน',
  ERR_ASSIGNMENT_CLOSED: 'งานนี้ปิดแล้ว (ส่งมอบ/ปฏิเสธ/ยกเลิก) แก้ไขไม่ได้',
  ERR_OFFER_NOT_AVAILABLE: 'งานนี้ถูกคนอื่นรับไปแล้ว หรือแอดมินยกเลิกประกาศ — รีเฟรชรายการงาน',
  ERR_SUBSCRIPTION_INVALID: 'ข้อมูลสมัครแจ้งเตือนไม่ถูกต้อง — ลองใหม่อีกครั้ง',
  ERR_NO_CUSTOMER_PROFILE: 'บัญชีนี้ยังไม่มีโปรไฟล์ในระบบ — ติดต่อแอดมิน',
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
