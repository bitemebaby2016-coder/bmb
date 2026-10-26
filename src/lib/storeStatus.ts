// ============================================
// Bite Me Baby — shared store open/closed status (UX 2026-10-14)
// ============================================
// ใช้ตรรกะเดียวกับแถบ "ร้านเปิด/ร้านปิด" บนหน้าแรก (homeProviders:
// getStoreStatusFromRounds) — หน้าแรกและมาสคอตจึงเห็นสถานะเดียวกันเสมอ
// - หน้าที่โหลดรอบส่งจริงมาแล้ว (เช่น HomePage) เรียก publishDeliveryRounds()
//   เพื่อให้ทุกคอมโพเนนต์ใช้ข้อมูลเดียวกัน
// - หน้าอื่นที่ยังไม่มีข้อมูล → auto-load รอบส่งจาก DB ครั้งเดียวต่อ session
// - ตรวจซ้ำทุก 60 วินาทีเมื่อเปิดเว็บค้างไว้ (useStoreClosed)
// ZERO-FAKE (closure 2026-10-18): ไม่มี fallback ตรรกะเวลาปลอม — ยังไม่มี
// ข้อมูลรอบส่ง = ยังไม่ยืนยันว่าเปิด (isOpen=false + ข้อความตรงไปตรงมา)
// ============================================

import { useEffect, useState } from 'react'
import { getStoreStatusFromRounds } from './homeProviders'
import { ensureShopConfigLoaded, getShopConfig, getShopHours, subscribeShopConfig } from './shopHours'
import type { StoreStatus } from '@/types'

type RoundsInput = Parameters<typeof getStoreStatusFromRounds>[0]

let publishedRounds: RoundsInput | null = null
let roundsLoadStarted = false
const listeners = new Set<() => void>()

/** สถานะเมื่อยังไม่มีข้อมูลรอบส่ง — ตรงไปตรงมา ไม่เดาเวลาเปิดร้าน */
export const UNKNOWN_STORE_STATUS: StoreStatus = {
  isOpen: false,
  state: 'closed',
  message: 'ยังยืนยันเวลาเปิดร้านไม่ได้ — ยังไม่มีข้อมูลรอบจัดส่ง',
}

/** หน้าที่มีข้อมูลรอบส่งจริงแล้ว (HomePage) เรียกแจ้งระบบกลาง */
export function publishDeliveryRounds(rounds: RoundsInput | null): void {
  publishedRounds = rounds && rounds.length > 0 ? rounds : null
  if (publishedRounds) roundsLoadStarted = true
  listeners.forEach((l) => l())
}

/** Auto-load รอบส่งจาก DB หนึ่งครั้ง — ทุกหน้าได้สถานะจาก authoritative source เดียวกัน */
async function ensureRoundsLoaded(): Promise<void> {
  if (roundsLoadStarted || publishedRounds) return
  roundsLoadStarted = true
  try {
    const { getDeliveryRoundsAdmin } = await import('./bmbAdminApi_rounds')
    const rounds = await getDeliveryRoundsAdmin()
    if (!publishedRounds) publishDeliveryRounds(rounds)
  } catch {
    roundsLoadStarted = false // โหลดไม่สำเร็จ = คงสถานะ unknown + ให้ retry ครั้งถัดไป
  }
}

/** สถานะร้านล่าสุด (ตรรกะเดียวกับ StoreStatusStrip) — sync กับ business_settings.hours/operating_hours */
export function currentStoreStatus(now: Date = new Date()): StoreStatus {
  if (!publishedRounds) return UNKNOWN_STORE_STATUS
  const cfg = getShopConfig()
  return getStoreStatusFromRounds(publishedRounds, now, {
    ...cfg,
    hoursClose: getShopHours()?.close,
  })
}

/** ร้านปิดอยู่ไหม — เช็คได้ทุกที่ในระบบ */
export function isStoreClosedNow(now: Date = new Date()): boolean {
  return !currentStoreStatus(now).isOpen
}

/** สมัครรับการเปลี่ยนแปลง (ใช้โดย useStoreClosed) */
function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/**
 * Hook: ร้านปิดอยู่ไหม (อัปเดตอัตโนมัติทุกนาที/เมื่อข้อมูลรอบส่งอัปเดต)
 * — ใช้บังคับมาสคอตท่า "ร้านปิด" ทุกเซกชัน
 */
export function useStoreClosed(): boolean {
  const [closed, setClosed] = useState<boolean>(() => isStoreClosedNow())
  useEffect(() => {
    void ensureRoundsLoaded() // ยังไม่มีข้อมูล = โหลดรอบส่งจริงจาก DB (ครั้งเดียว)
    void ensureShopConfigLoaded() // SYNC: โหลด business_settings.hours + operating_hours
    const sync = () => setClosed(isStoreClosedNow())
    sync()
    const timer = setInterval(sync, 60_000)
    const unsub = subscribe(sync)
    const unsubCfg = subscribeShopConfig(sync)
    return () => { clearInterval(timer); unsub(); unsubCfg() }
  }, [])
  return closed
}