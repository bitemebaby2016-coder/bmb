// ============================================
// Bite Me Baby — Mascot self-service (ADM-07, migration 021)
// Admin swaps mascot art per role name (greeting/cooking/delivering/empty_cart…)
// via mascot_overrides — storefront renders the override without any code change.
// R67 Chat-hang close (README §10.4): ทุก query มี deadline — ค้าง = คืนค่า
//   fallback ภายใน MASCOT_LOAD_TIMEOUT_MS เสมอ (promise ไม่มีวันแขวนถาวร)
// ============================================

import { supabase } from './supabase'

export interface MascotOverride {
  role_name: string
  media_url: string
  alt: string
  updated_at: string
}

/** Deadline โหลด override — เกินนี้ = ใช้ static fallback ต่อ (ห้ามแขวน UI) */
export const MASCOT_LOAD_TIMEOUT_MS = 8000

function withDeadline<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label + '_timeout')), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

/** Public read (anon SELECT allowed) — storefront mascot resolution. Timeout-safe. */
export async function getMascotOverrides(): Promise<MascotOverride[]> {
  try {
    const { data, error } = await withDeadline(
      supabase.from('mascot_overrides').select('role_name,media_url,alt,updated_at'),
      MASCOT_LOAD_TIMEOUT_MS,
      'mascot_overrides_read',
    )
    if (error) return []
    return (data ?? []) as MascotOverride[]
  } catch {
    // timeout/network = static fallback — ห้าม throw เข้าหน้าแชต/หน้าร้าน
    return []
  }
}

/** Resolve the override URL for a role (returns '' when no override set). */
export function resolveOverride(overrides: MascotOverride[], roleName: string): MascotOverride | undefined {
  return overrides.find((o) => o.role_name === roleName && o.media_url?.length > 0)
}

/** Admin upsert (guard inside RPC). Timeout-safe — เกินเวลา = แจ้งไม่สำเร็จ. */
export async function upsertMascotOverride(roleName: string, mediaUrl: string, alt = ''): Promise<boolean> {
  try {
    const { error } = await withDeadline(
      supabase.rpc('upsert_mascot_override', {
        p_role_name: roleName,
        p_media_url: mediaUrl,
        p_alt: alt,
      }),
      MASCOT_LOAD_TIMEOUT_MS,
      'mascot_override_upsert',
    )
    return !error
  } catch {
    return false
  }
}

/** Roles the mascot badge can render — ครบทุก pose ใน /assets/mascot/
 * (role_name ตรงกับ pose key ของ MascotBadge/BiteMascot พอดี → admin เปลี่ยนได้ทุกท่า) */
export const MASCOT_ROLES = [
  'greeting',
  'heart',
  'thumbsup',
  'running',
  'pointing',
  'peeking',
  'thinking',
  'empty',
  'bye',
  'award',
  'cooking',
  'eating',
  'feedback',
  'menu',
  'ready',
  'recommend',
  'reviewing',
  'shopping',
  'success',
  'vote',
  'waiting',
  'sad',
  'closed',
] as const

// ---- Admin override cache (โหลดครั้งเดียวต่อ session, แชร์ทุก component) ----
let overridesCache: MascotOverride[] | null = null
let overridesPromise: Promise<MascotOverride[]> | null = null

/** โหลด override ทั้งหมด (cache — เรียกซ้ำเมื่อ admin บันทึกด้วย force=true)
 *  R67: promise เสมอ settle (timeout ใน getMascotOverrides) → ไม่มีค้างถาวร */
export async function loadMascotOverrides(force = false): Promise<MascotOverride[]> {
  if (!force && overridesCache) return overridesCache
  if (!force && overridesPromise) return overridesPromise
  overridesPromise = getMascotOverrides().then((list) => {
    overridesCache = list
    return list
  })
  return overridesPromise
}

/** ล้าง cache (เรียกหลัง admin บันทึก override ใหม่) */
export function invalidateMascotOverrides(): void {
  overridesCache = null
  overridesPromise = null
}

/** ตรวจสอบว่า cache โหลดเสร็จแล้วหรือยัง (ใช้สำหรับ synchronous check ใน component) */
export function isMascotOverridesLoaded(): boolean {
  return overridesCache !== null
}

/** หา URL จาก override ของ pose (sync — ใช้กับ cache ที่โหลดแล้วเท่านั้น) */
export function getOverrideUrl(pose: string): string | undefined {
  const hit = resolveOverride(overridesCache ?? [], pose)
  return hit?.media_url
}

// ============================================
// R206 — Mascot Self-Service ใช้งานได้จริง: bucket + upload + live refresh
// Owner สร้าง bucket `Bite_Mascot` เอง (2026-11-15) — ระบบเชื่อม bucket นี้ตรง ๆ
// ============================================

/** Bucket มาสคอตจริงของโปรเจกต์ (Owner สร้างใน dashboard — migration 206 คุม policies) */
export const MASCOT_BUCKET = 'Bite_Mascot'

/** ขนาดสูงสุดไฟล์มาสคอต — GIF แอนิเมตใหญ่ได้ (ตรง MAX_GIF_BYTES ฝั่ง bmbAdminApi_media) */
export const MASCOT_MAX_BYTES = 15 * 1024 * 1024 // 15 MB

const MASCOT_MIME_WHITELIST = ['image/gif', 'image/png', 'image/webp', 'image/jpeg']

export interface MascotFileValidation {
  ok: boolean
  error?: string
}

/** ตรวจไฟล์มาสคอตก่อนอัปโหลด — รองรับ GIF (แอนิเมต) / PNG / WebP / JPG */
export function validateMascotFile(file: File): MascotFileValidation {
  if (!MASCOT_MIME_WHITELIST.includes(file.type)) {
    return { ok: false, error: `ERR_INVALID_MIME (${file.type || 'unknown'} — รองรับ GIF/PNG/WebP/JPG)` }
  }
  if (file.size <= 0 || file.size > MASCOT_MAX_BYTES) {
    return { ok: false, error: `ERR_INVALID_SIZE (${(file.size / 1024 / 1024).toFixed(2)} MB — สูงสุด 15 MB)` }
  }
  return { ok: true }
}

/** ชื่อไฟล์ปลอดภัย (ตัดอักขระที่ Supabase Storage ไม่รับ) — local เพื่อไม่ดึง bmbAdminApi_media มาพร้อมกัน */
function sanitizeMascotName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-{2,}/g, '-').slice(0, 80) || 'mascot'
}

/** อัปโหลดไฟล์มาสคอตเข้า bucket `Bite_Mascot` ตรง — คืน public URL (null = ล้มเหลว)
 *  R206: ZERO-FAKE — error จาก storage (policy/เครือข่าย) ถูก log และคืน null เสมอ */
export async function uploadMascotAsset(file: File): Promise<string | null> {
  const v = validateMascotFile(file)
  if (!v.ok) {
    console.error('[mascot] validation error:', v.error)
    return null
  }
  const path = `${Date.now()}-${sanitizeMascotName(file.name)}`
  try {
    const { error } = await withDeadline(
      supabase.storage.from(MASCOT_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false }),
      MASCOT_LOAD_TIMEOUT_MS,
      'mascot_upload',
    )
    if (error) {
      console.error('[mascot] upload error:', error.message)
      return null
    }
    const { data } = supabase.storage.from(MASCOT_BUCKET).getPublicUrl(path)
    return data?.publicUrl ?? null
  } catch {
    return null
  }
}

export interface MascotBucketFile {
  name: string
  url: string
  updated_at: string
}

/** รายการไฟล์ใน bucket `Bite_Mascot` (root — ตรงที่ Owner ใช้อยู่) สำหรับ quick-pick */
export async function listMascotBucketFiles(limit = 24): Promise<MascotBucketFile[]> {
  try {
    const { data, error } = await withDeadline(
      supabase.storage.from(MASCOT_BUCKET).list('', { limit: Math.min(limit, 100), sortBy: { column: 'created_at', order: 'desc' } }),
      MASCOT_LOAD_TIMEOUT_MS,
      'mascot_bucket_list',
    )
    if (error || !data) return []
    return (data as Array<{ name: string; updated_at?: string }>)
      .filter((f) => f.name && !f.name.startsWith('.') && !f.name.endsWith('/'))
      .slice(0, limit)
      .map((f) => ({
        name: f.name,
        url: supabase.storage.from(MASCOT_BUCKET).getPublicUrl(f.name).data.publicUrl,
        updated_at: f.updated_at ?? '',
      }))
  } catch {
    return []
  }
}

// ---- Live refresh (R206): admin บันทึก → badge ที่ mount อยู่แล้วเปลี่ยนทันทีใน session เดิม ----
export const MASCOT_OVERRIDES_CHANGED_EVENT = 'bmb:mascot-overrides-changed'

/** ประกาศให้ทุก mascot component ที่แสดงอยู่ reload override ทันที (ไม่ต้อง deploy/refresh หน้า) */
export function notifyMascotOverridesChanged(): void {
  try {
    window.dispatchEvent(new Event(MASCOT_OVERRIDES_CHANGED_EVENT))
  } catch {
    // สภาพแวดล้อมไม่มี window (SSR/test) — ข้ามได้ปลอดภัย
  }
}
