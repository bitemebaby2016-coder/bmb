// ============================================
// Bite Me Baby — Mascot self-service (ADM-07, migration 021)
// Admin swaps mascot art per role name (greeting/cooking/delivering/empty_cart…)
// via mascot_overrides — storefront renders the override without any code change.
// ============================================

import { supabase } from './supabase'

export interface MascotOverride {
  role_name: string
  media_url: string
  alt: string
  updated_at: string
}

/** Public read (anon SELECT allowed) — storefront mascot resolution. */
export async function getMascotOverrides(): Promise<MascotOverride[]> {
  const { data, error } = await supabase.from('mascot_overrides').select('role_name,media_url,alt,updated_at')
  if (error) return []
  return (data ?? []) as MascotOverride[]
}

/** Resolve the override URL for a role (returns '' when no override set). */
export function resolveOverride(overrides: MascotOverride[], roleName: string): MascotOverride | undefined {
  return overrides.find((o) => o.role_name === roleName && o.media_url?.length > 0)
}

/** Admin upsert (guard inside RPC). */
export async function upsertMascotOverride(roleName: string, mediaUrl: string, alt = ''): Promise<boolean> {
  const { error } = await supabase.rpc('upsert_mascot_override', {
    p_role_name: roleName,
    p_media_url: mediaUrl,
    p_alt: alt,
  })
  return !error
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

/** โหลด override ทั้งหมด (cache — เรียกซ้ำเมื่อ admin บันทึกด้วย force=true) */
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

/** หา URL จาก override ของ pose (sync — ใช้กับ cache ที่โหลดแล้วเท่านั้น) */
export function getOverrideUrl(pose: string): string | undefined {
  const hit = resolveOverride(overridesCache ?? [], pose)
  return hit?.media_url
}