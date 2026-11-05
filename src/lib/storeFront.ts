// ============================================
// Bite Me Baby — Store Front info (N-8 · R69 · 2026-11-05)
// ============================================
// รูปหน้าร้าน + รายละเอียดร้าน + ตำแหน่งร้าน สำหรับเส้นทาง "รับที่ร้าน"
// (แอดมินเพิ่มรูป/รายละเอียดเองที่แท็บ "หน้าร้าน" ข้างแท็บมาสคอตในการตั้งค่าร้าน)
//
// เก็บใน business_settings (anon อ่านได้ทุกคีย์ตาม policy 164):
//   store_front      = { description: string, photos: string[] } (URL จาก Media Library)
//   kitchen_location = { latitude, longitude, address } — ตำแหน่งร้าน/ครัวที่แอดมินตั้ง
//                      (m008/m134 · คีย์เดิมที่ระบบค่าส่งใช้อยู่ — ห้ามสร้างคีย์ตำแหน่งใหม่)
// ฝั่งลูกค้า = READ-ONLY เสมอ · ข้อมูลไม่ครบ = แสดงเฉพาะส่วนที่มีจริง (zero-fake)
// ============================================

import { supabase } from './supabase'

export interface StoreFrontInfo {
  description: string
  photos: string[]
}

export interface StoreLocation {
  address: string
  latitude: number | null
  longitude: number | null
}

function safeParse(v: string): unknown {
  try { return JSON.parse(v) } catch { return null }
}

/** แปลงค่าดิบจาก business_settings → StoreFrontInfo (ค่าเสีย/ขาด = ค่าว่างเปล่า ไม่เดา) */
export function parseStoreFront(value: unknown): StoreFrontInfo {
  const raw = typeof value === 'string' ? safeParse(value) : value
  const v = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const photos = Array.isArray(v.photos)
    ? v.photos.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    : []
  return {
    description: typeof v.description === 'string' ? v.description : '',
    photos,
  }
}

/** แปลงค่าดิบ kitchen_location → StoreLocation */
export function parseStoreLocation(value: unknown): StoreLocation | null {
  const raw = typeof value === 'string' ? safeParse(value) : value
  const v = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null) as Record<string, unknown> | null
  if (!v) return null
  const lat = typeof v.latitude === 'number' ? v.latitude : null
  const lng = typeof v.longitude === 'number' ? v.longitude : null
  const address = typeof v.address === 'string' ? v.address : ''
  if (lat == null && lng == null && !address) return null
  return { address, latitude: lat, longitude: lng }
}

/** อ่านข้อมูลหน้าร้าน (อ่านไม่ได้ = ค่าว่างเปล่า — ไม่แต่งข้อมูลปลอม) */
export async function getStoreFront(): Promise<StoreFrontInfo> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('value')
    .eq('key', 'store_front')
    .maybeSingle()
  if (error || !data) return { description: '', photos: [] }
  return parseStoreFront(data.value)
}

/** ตำแหน่งร้านจาก kitchen_location (ที่แอดมินตั้ง = สถานที่รับจริง) */
export async function getStoreLocation(): Promise<StoreLocation | null> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('value')
    .eq('key', 'kitchen_location')
    .maybeSingle()
  if (error || !data) return null
  return parseStoreLocation(data.value)
}

/** บันทึกข้อมูลหน้าร้าน (แอดมิน · แท็บหน้าร้าน) — เขียนผ่าน business_settings เดิม */
export async function saveStoreFront(info: StoreFrontInfo): Promise<boolean> {
  const { setBusinessSetting } = await import('./bmbAdminApi_settings')
  return setBusinessSetting('store_front', {
    description: info.description.trim(),
    photos: info.photos.filter((p) => p.trim() !== ''),
  })
}

/** ลิงก์ Google Maps นำทาง "มาร้าน" (ปลายทาง = ตำแหน่งร้านที่แอดมินตั้ง) */
export function storeDirectionsUrl(loc: StoreLocation): string | null {
  if (loc.latitude == null || loc.longitude == null) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`
}