'use strict'
// _r67_t1_mascot — R67-T1 Chat-Hang: overwrite src/lib/mascotService.ts (whole file)
// Root cause (README §10.4 "Chat-hang ของ mascotService (timeout)"): query ไม่มี
// deadline — เน็ตค้าง = promise ไม่ settle เลย = ทุก caller แขวน (overridesPromise
// ที่ cache ไว้ก็ค้างถาวรทั้ง session). Fix: ทุก query มี timeout 8 วิ → เสมอ settle
// (timeout = [] / false = static fallback) + cache ไม่มีวันเก็บ promise ที่ค้าง.
const fs = require('fs')
const TARGET = 'src/lib/mascotService.ts'

const CONTENT = `// ============================================
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

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
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

/** หา URL จาก override ของ pose (sync — ใช้กับ cache ที่โหลดแล้วเท่านั้น) */
export function getOverrideUrl(pose: string): string | undefined {
  const hit = resolveOverride(overridesCache ?? [], pose)
  return hit?.media_url
}
`

fs.writeFileSync(TARGET, CONTENT, 'utf8')
const lines = CONTENT.split('\n')
console.log('OK wrote ' + TARGET + ' lines=' + lines.length + ' chars=' + CONTENT.length)
// line-assert checks
const must = ['MASCOT_LOAD_TIMEOUT_MS = 8000', 'function withDeadline', 'mascot_overrides_read', 'mascot_override_upsert', 'invalidateMascotOverrides', 'export const MASCOT_ROLES']
for (const m of must) {
  if (!CONTENT.includes(m)) { console.error('FAIL missing: ' + m); process.exit(1) }
}
console.log('ALL_ASSERTS_OK')
