// ============================================
// BMB — Store status strip copy (admin-editable)
// ============================================
// N1 (สั่งจาก Owner 4-2 · R19): แอดมินแก้ "ข้อความ" แถบสถานะหน้าแรกเองได้
// โดยไม่ต้องแตะโค้ด — คีย์ business_settings `store_status_copy`
//   ⚠️ คงเดิม = ไฟสถานะ 🟢/🔴 (sameDayOpen / preOrderOpen) คำนวณจากรอบจริงเสมอ
//      ห้าม override จากคีย์นี้ (sameDayOpen/preOrderOpen ห้าม override = กติกา Owner)
//   ⚠️ บรรทัดพรีออเดอร์ "เปิดรับ … รอบ X DD/MM/YYYY (ปิดรอบ HH:MM)" เป็นข้อมูลสด
//      (R18 copy ของ Owner) → ไม่รับ override /static — มีแค่บรรทัด "ปิดรับแล้ว" ที่แก้ได้
// อ่านจาก business_settings (anon อ่านได้ = policy 164) · cache 7 นาที (แบบ seoSettings)
// ============================================

import { supabase } from './supabase'

export const STORE_STATUS_COPY_KEY = 'store_status_copy'

export interface StoreStatusCopy {
  /** บรรทัดบนเมื่อเซมเดย์เปิด (state 'open') */
  sameDayOpen: string
  /** บรรทัดบนเมื่อวันนี้ปิดรับหมด แต่ยังรับจองล่วงหน้าได้ (state 'preorder_only') */
  preOrderOnly: string
  /** บรรทัดบนเมื่อไม่มีรอบเปิดรับเลย (state 'closed') */
  closed: string
  /** บรรทัดล่างเมื่อพรีออเดอร์ปิดรับแล้ว (nextPre = null) */
  preOrderClosed: string
}

/** ค่าจริงที่โค้ดใช้อยู่ตอนนี้ — ทั้ง fallback ของ client และตัวเทียบแมตช์ */
export const DEFAULT_STORE_STATUS_COPY: StoreStatusCopy = {
  sameDayOpen: 'เปิดรับออเดอร์ เซมเดย์ : ส่งทันที',
  preOrderOnly: 'เปิดรับออเดอร์จองล่วงหน้า — รอบวันนี้ปิดรับแล้ว',
  closed: 'ยังไม่เปิดรับออเดอร์ — ไม่มีรอบจัดส่งที่เปิดรับอยู่',
  preOrderClosed: 'พรีออเดอร์: ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป',
}

// ---- reactive live store (strip สมัครสมาชิก → re-render ทันทีเมื่อค่าเปลี่ยน) ----
let live: StoreStatusCopy = { ...DEFAULT_STORE_STATUS_COPY }
let liveVersion = 0
const listeners = new Set<() => void>()

function commit(next: StoreStatusCopy): void {
  live = next
  liveVersion++
  for (const fn of listeners) fn()
}

/** Sync อ่านค่าปัจจุบัน (default จริง ก่อนโหลด/ตอนโหลดไม่ได้) */
export function getStoreStatusCopySync(): StoreStatusCopy {
  return live
}

export function getStoreStatusCopyVersion(): number {
  return liveVersion
}

export function subscribeStoreStatusCopy(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Set ค่า ณ รันไทม์ (ไม่เขียน DB) — ใช้ตอน admin กดบันทึกให้เห็นผลทันที + test */
export function setStoreStatusCopyLive(next: StoreStatusCopy): void {
  commit(next)
}

const CACHE_MS = 7 * 60 * 1000
let cache: { at: number; value: StoreStatusCopy } | null = null

function merge(partial: Partial<StoreStatusCopy> | null): StoreStatusCopy {
  const out: StoreStatusCopy = { ...DEFAULT_STORE_STATUS_COPY }
  if (partial && typeof partial === 'object') {
    for (const k of Object.keys(DEFAULT_STORE_STATUS_COPY) as Array<keyof StoreStatusCopy>) {
      const v = partial[k]
      // ค่าว่าง/ไม่ใช่ string = ใช้ค่า default (ห้ามให้แถบว่าง)
      if (typeof v === 'string' && v.trim()) out[k] = v.trim()
    }
  }
  return out
}

/** ดึง copy จาก business_settings (fallback = ค่าที่โค้ดใช้อยู่) — โหลดสำเร็จ commit เข้า live */
export async function getStoreStatusCopy(force = false): Promise<StoreStatusCopy> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', STORE_STATUS_COPY_KEY)
      .maybeSingle()
    if (error) throw error
    const value = merge((data?.value ?? null) as Partial<StoreStatusCopy> | null)
    cache = { at: Date.now(), value }
    commit(value)
    return value
  } catch {
    // โหลดไม่ได้ = ใช้ค่าจริงของร้านต่อ (แถบห้ามพัง)
    return cache?.value ?? { ...DEFAULT_STORE_STATUS_COPY }
  }
}

/**
 * เปลี่ยนข้อความบรรทัดบนตาม state — **แมตช์กับค่า default เท่านั้น**
 * (ค่าที่คำนวณจากรอบจริงค่าอื่น ๆ ที่ยังไม่มีในคีย์ = ไม่แตะ)
 * เหตุผล: provider ยังคงปล่อยข้อความ default ออกมาเสมอ → strip สลับเป็นของแอดมินตรงนี้
 */
export function statusMessageWithCopy(
  message: string,
  copy: StoreStatusCopy = getStoreStatusCopySync(),
): string {
  const m = (message ?? '').trim()
  if (!m) return m
  if (m === DEFAULT_STORE_STATUS_COPY.sameDayOpen) return pick(copy.sameDayOpen, m)
  if (m === DEFAULT_STORE_STATUS_COPY.preOrderOnly) return pick(copy.preOrderOnly, m)
  if (m === DEFAULT_STORE_STATUS_COPY.closed) return pick(copy.closed, m)
  return m
}

/** ค่า override ที่ยังไม่ trim/ว่างเปล่า → ใช้ค่า default (แถบห้ามว่าง) */
function pick(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim()
  return v || fallback
}

/**
 * บรรทัดพรีออเดอร์ — แก้ได้เฉพาะบรรทัด "ปิดรับแล้ว" (ค่าคงที่)
 * บรรทัดเปิดรับ (ชื่อรอบ + วันที่ + ปิดรอบ) = ข้อมูลสด R18 → ไม่รับ override
 */
export function preOrderLineWithCopy(
  preOrderLine: string | undefined,
  copy: StoreStatusCopy = getStoreStatusCopySync(),
): string | undefined {
  const line = (preOrderLine ?? '').trim()
  if (!line) return preOrderLine
  if (line === DEFAULT_STORE_STATUS_COPY.preOrderClosed) return pick(copy.preOrderClosed, line)
  return preOrderLine
}

/** Test helper — ล้าง cache (live กลับค่า default) */
export function resetStoreStatusCopyCache(): void {
  cache = null
  commit({ ...DEFAULT_STORE_STATUS_COPY })
}
