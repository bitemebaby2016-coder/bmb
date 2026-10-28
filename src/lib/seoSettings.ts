// ============================================
// BMB — SEO copy settings (admin-editable)
// ============================================
// R12 (Owner ยืนยัน 2026-10-28): แก้ SEO copy/คำโปรยเองได้โดยไม่แตะโค้ด
// แก้ที่หน้า Admin → Business Settings (คีย์ `seo`) · หน้าแรก/meta/JSON-LD
// อ่านค่าจริงจากที่นี่ (fallback = ค่าจริงที่ Owner ยืนยันแล้ว)
// อ่านจาก business_settings (anon อ่านได้ = policy 164) · cache 7 นาที
// ============================================

import { supabase } from './supabase'

export const SEO_SETTINGS_KEY = 'seo'

export interface SeoSettings {
  /** meta description ของหน้าแรก (og/twitter สืบทอดจากค่านี้) */
  description: string
  /** ท้ายชื่อหน้าแรก/หน้า shop เช่น "สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม." */
  tagline: string
}

/** ค่าจริงที่ Owner ยืนยันแล้ว (2026-10-28) — fallback + ค่าเริ่มต้น */
export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  description:
    'ร้านอาหารไทยจัดส่งถึงบ้านในรัศมี 5 กม. จากตัวเมืองจันทบุรี ให้บริการรอบเช้า กลางวัน เย็น ส่งด้วยรถไฟฟ้าอัจฉริยะ',
  tagline: 'สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม.',
}

// ---- reactive live store (App สมัครสมาชิก → re-render meta เมื่อค่าจริงเปลี่ยน) ----
let live: SeoSettings = DEFAULT_SEO_SETTINGS
let liveVersion = 0
const listeners = new Set<() => void>()

function commit(next: SeoSettings): void {
  live = next
  liveVersion++
  for (const fn of listeners) fn()
}

/** Sync อ่านค่าปัจจุบัน (default จริง ก่อนโหลด/ตอนโหลดไม่ได้) */
export function getSeoSettingsSync(): SeoSettings {
  return live
}

export function getSeoSettingsVersion(): number {
  return liveVersion
}

export function subscribeSeoSettings(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Set ค่า ณ รันไทม์ (ไม่เขียน DB) — ใช้สำหรับ admin preview/test */
export function setSeoSettingsLive(next: SeoSettings): void {
  commit(next)
}

const CACHE_MS = 7 * 60 * 1000
let cache: { at: number; value: SeoSettings } | null = null

function merge(partial: Partial<SeoSettings> | null): SeoSettings {
  const out: SeoSettings = { ...DEFAULT_SEO_SETTINGS }
  if (partial && typeof partial === 'object') {
    if (typeof partial.description === 'string' && partial.description.trim()) {
      out.description = partial.description.trim()
    }
    if (typeof partial.tagline === 'string' && partial.tagline.trim()) {
      out.tagline = partial.tagline.trim()
    }
  }
  return out
}

/** ดึง SEO copy จาก business_settings (fallback = ค่าจริงเริ่มต้น) — โหลดสำเร็จ
 *  commit เข้า live store ให้ App re-render ทันที */
export async function getSeoSettings(force = false): Promise<SeoSettings> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', SEO_SETTINGS_KEY)
      .maybeSingle()
    if (error) throw error
    const value = merge((data?.value ?? null) as Partial<SeoSettings> | null)
    cache = { at: Date.now(), value }
    commit(value)
    return value
  } catch {
    // โหลดไม่ได้ = ใช้ค่าจริงของร้านต่อ (meta ห้ามพัง)
    return cache?.value ?? DEFAULT_SEO_SETTINGS
  }
}

/** Test helper — ล้าง cache (live กลับค่า default) */
export function resetSeoSettingsCache(): void {
  cache = null
  commit({ ...DEFAULT_SEO_SETTINGS })
}