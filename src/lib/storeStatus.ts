// ============================================
// Bite Me Baby — shared store open/closed status (UX 2026-10-14)
// ============================================
// ใช้ตรรกะเดียวกับแถบ "ร้านเปิด/ร้านปิด" บนหน้าแรก (homeProviders:
// getStoreStatus / getStoreStatusFromRounds) — หน้าแรกและมาสคอตจึงเห็น
// สถานะเดียวกันเสมอ
// - หน้าที่โหลดรอบส่งจริงมาแล้ว (เช่น HomePage) เรียก publishDeliveryRounds()
//   เพื่อให้ทุกคอมโพเนนต์ใช้ข้อมูลเดียวกัน
// - ตรวจซ้ำทุก 60 วินาทีเมื่อเปิดเว็บค้างไว้ (useStoreClosed)
// Pure display state — ไม่ fetch เอง ไม่แตะข้อมูลธุรกิจ
// ============================================

import { useEffect, useState } from 'react'
import { getStoreStatus, getStoreStatusFromRounds } from './homeProviders'
import type { StoreStatus } from '@/types'

type RoundsInput = Parameters<typeof getStoreStatusFromRounds>[0]

let publishedRounds: RoundsInput | null = null
const listeners = new Set<() => void>()

/** หน้าที่มีข้อมูลรอบส่งจริงแล้ว (HomePage) เรียกแจ้งระบบกลาง */
export function publishDeliveryRounds(rounds: RoundsInput | null): void {
  publishedRounds = rounds && rounds.length > 0 ? rounds : null
  listeners.forEach((l) => l())
}

/** สถานะร้านล่าสุด (ตรรกะเดียวกับ StoreStatusStrip) */
export function currentStoreStatus(now: Date = new Date()): StoreStatus {
  return publishedRounds ? getStoreStatusFromRounds(publishedRounds, now) : getStoreStatus(now)
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
    const sync = () => setClosed(isStoreClosedNow())
    sync()
    const timer = setInterval(sync, 60_000)
    const unsub = subscribe(sync)
    return () => { clearInterval(timer); unsub() }
  }, [])
  return closed
}