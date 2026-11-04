// ============================================
// Bite Me Baby — shop config loader (business_settings.hours + operating_hours + store_master_open)
// โหลดครั้งเดียวต่อ session · subscribe เพื่อ re-render เมื่อค่ามาถึง
// คู่กับ shopHoursLogic (pure) + storeMaster (pure) — ตัวนี้มี I/O อย่างเดียว
// ============================================

import { supabase } from './supabase'
import { hoursToMs, type ShopHours, type ShopHoursMs } from './shopHoursLogic'
import { STORE_MASTER_KEY, masterOpenFromConfig } from './storeMaster'

let hours: ShopHours | null = null
let operating: Record<string, boolean> | null = null
/** master เปิดร้านไหม · null = ยังไม่ได้โหลด (ห้ามเดา — ZERO-FAKE) */
let masterOpen: boolean | null = null
let loaded = false
const listeners = new Set<() => void>()

export function getShopHours(): ShopHours | null { return hours }
export function getOperatingHours(): Record<string, boolean> | null { return operating }
export function getStoreMasterOpen(): boolean | null { return masterOpen }
export function subscribeShopConfig(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** ค่าที่ส่งเข้า getStoreStatusFromRounds / roundBookability (undefined = ยังไม่รู้ → ห้ามเดา) */
export function getShopConfig(): { shopHoursMs: ShopHoursMs | null; operatingHours: Record<string, boolean | undefined> | null; masterOpen: boolean | null } | undefined {
  if (!loaded) return undefined
  return { shopHoursMs: hoursToMs(hours), operatingHours: operating, masterOpen }
}

export async function ensureShopConfigLoaded(force = false): Promise<void> {
  if (loaded && !force) return
  try {
    const { data } = await supabase
      .from('business_settings')
      .select('key, value')
      .in('key', ['hours', 'operating_hours', STORE_MASTER_KEY])
    let got = false
    for (const row of data ?? []) {
      const v = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
      if (row.key === 'hours' && v && typeof v.open === 'string' && typeof v.close === 'string') {
        hours = { open: v.open, close: v.close }
        got = true
      }
      if (row.key === 'operating_hours' && v && typeof v === 'object') {
        operating = {}
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
          if (typeof val === 'boolean') operating[k] = val
        }
        got = true
      }
      if (row.key === STORE_MASTER_KEY) {
        // มีแถว = รู้ค่าจริง (parse เพี้ยน = เปิดร้าน — mirror storeMaster ZERO-FAKE)
        masterOpen = masterOpenFromConfig(v)
        got = true
      }
    }
    if (got) {
      loaded = true
      listeners.forEach((l) => l())
    }
  } catch {
    // อ่านไม่ได้ = คง null (ห้ามเดาเวลาเปิดปิด) — retry ได้เมื่อ force
  }
}