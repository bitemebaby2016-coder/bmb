// ============================================
// Bite Me Baby — useRiderIdentity (ADDENDUM 2026-10-20: Rider Portal entry)
// ตรวจว่า session ปัจจุบันเป็น "ไรเดอร์ที่แอดมินผูกบัญชีแล้ว" หรือไม่
// โดยถามเซิร์ฟเวอร์ผ่าน RPC driver_login (041 — SECURITY DEFINER,
// auth.uid() → drivers.user_id) — ห้ามอนุมานจากเบอร์โทร/ชื่อ/ข้อมูล client
// ผลลัพธ์ใช้ "ซ่อน/แสดง" ปุ่มทางเข้าเท่านั้น (UX) — authorization จริงอยู่ที่
// /rider + RPC ฝั่งเซิร์ฟเวอร์เหมือนเดิมทุกประการ
// ============================================

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { driverLogin, type DriverRecord } from '@/lib/driverService'

export function useRiderIdentity(): {
  loading: boolean
  driver: DriverRecord | null
  recheck: () => Promise<void>
} {
  const [loading, setLoading] = useState(true)
  const [driver, setDriver] = useState<DriverRecord | null>(null)

  const recheck = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setDriver(null)
        return
      }
      // server-verified: ไม่มี driver row ที่ผูก user นี้ → ไม่ใช่ไรเดอร์ (null)
      const d = await driverLogin()
      setDriver(d)
    } catch {
      setDriver(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void recheck()
  }, [recheck])

  return { loading, driver, recheck }
}