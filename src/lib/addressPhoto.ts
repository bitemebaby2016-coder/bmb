// ============================================
// Bite Me Baby — Address photo (R10 · Owner 2026-10-27)
// ============================================
// "ให้มีปุ่มถ่ายรูปและแนบรูปที่อยู่ลูกค้า" ที่หน้าเช็คเอาท์ — ลูกค้าถ่าย/เลือกรูป
// หน้าบ้าน/จุดส่งให้ไรเดอร์เห็น · เก็บใน bucket ส่วนตัว `address-photos`
// (path = <user>/<timestamp>-<name> — storage policy บังคับโฟลเดอร์ตัวเอง)
// · attach_address_photo (migration 161) ผูก path เข้า orders.address_photo_url
// ============================================

import { supabase } from './supabase'

export const ADDRESS_PHOTO_BUCKET = 'address-photos'
export const ADDRESS_PHOTO_MAX_BYTES = 10 * 1024 * 1024 // รับไม่เกิน 10MB

export interface AddressPhotoUpload {
  ok: boolean
  path?: string
  error?: string
}

/** ตรวจไฟล์ + upload เข้าโฟลเดอร์ของผู้ใช้ — คืน object path (ใช้กับ signed URL ทีหลัง) */
export async function uploadAddressPhoto(file: File, userTag: string): Promise<AddressPhotoUpload> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'ไฟล์ต้องเป็นรูปภาพ' }
  if (file.size > ADDRESS_PHOTO_MAX_BYTES) return { ok: false, error: 'รูปใหญ่เกิน 10MB — ลองถ่ายใหม่หรือย่อรูปก่อน' }
  const safeName = (file.name || 'photo.jpg').replace(/[^\w.-]/g, '_').slice(-40)
  const folder = String(userTag || 'guest').replace(/[^\w-]/g, '')
  const path = `${folder}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from(ADDRESS_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) {
    console.warn('[AddressPhoto] upload failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, path }
}

/** ผูก path รูปเข้าออเดอร์ (server: attach_address_photo — เจ้าของออเดอร์/แอดมินเท่านั้น) */
export async function attachAddressPhoto(orderNumber: string, path: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('attach_address_photo', {
    p_order_number: orderNumber,
    p_url: path,
  })
  if (error) {
    console.warn('[AddressPhoto] attach failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** signed URL สำหรับแสดงรูป (เจ้าของ/แอดมิน — ผ่าน RLS ของ bucket) */
export async function getAddressPhotoUrl(path: string, expiresSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ADDRESS_PHOTO_BUCKET)
    .createSignedUrl(path, expiresSec)
  if (error) return null
  return data?.signedUrl ?? null
}

/** ไรเดอร์/แอดมิน: ดึง path รูปที่อยู่ของออเดอร์ (server RPC get_address_photo · 162) */
export async function fetchAddressPhotoPath(orderNumber: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_address_photo', { p_order_number: orderNumber })
  if (error) return null
  return (data as string | null) ?? null
}
