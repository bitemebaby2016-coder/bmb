import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { resolveAuthSyncAction, LOGIN_PATH } from '@/lib/authSessionSync'
import { useAuthStore } from '@/store/authStore'

/**
 * N3 (R19 · QA review 2026-10-29 ข้อ 1.6) — listener auth กลางตัวเดียวของแอป
 *
 * mount ครั้งเดียวใน `<App>` (อยู่ใต้ BrowserRouter → ใช้ navigate แบบ SPA ได้)
 * รับ `onAuthStateChange` แล้วแปลงเป็น action ผ่าน `resolveAuthSyncAction`:
 *   SIGNED_OUT    → clear store + เด้ง /login เก็บ `from`
 *   TOKEN_REFRESHED → refreshRole()
 *   USER_UPDATED / SIGNED_IN → re-map customer
 *
 * หมายเหตุ implementation:
 * - callback ของ onAuthStateChange ถูกเรียกขณะ supabase-js ถือ lock อยู่ →
 *   **ห้าม await คำสั่ง Supabase อื่นในนั้น** ( deadlock ) → ทุกอย่างที่แตะ supabase
 *   ถูก defer ด้วย setTimeout(0) · ส่วน clear store = zustand ล้วน ทำได้ทันที
 * - อ่าน location ผ่าน ref ไม่ต้อง re-subscribe ทุกครั้งที่ pathname เปลี่ยน
 */
export function AuthSessionSync() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location)
  locationRef.current = location

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const store = useAuthStore.getState()
      const here = locationRef.current
      const action = resolveAuthSyncAction({
        event,
        wasAuthenticated: store.isAuthenticated,
        path: here.pathname + here.search,
      })

      if (action.clear) store.clearSession()

      const user = session?.user ?? null
      if (action.remapUser && user) {
        const u = user
        // defer: supabase.auth ยังถือ lock อยู่ใน callback (ดูหัวไฟล์)
        setTimeout(() => useAuthStore.getState().syncFromAuthUser(u), 0)
      }
      if (action.refreshRole) {
        setTimeout(() => void useAuthStore.getState().refreshRole(), 0)
      }
      if (action.redirectLogin) {
        navigate(LOGIN_PATH, { replace: true, state: { from: action.from } })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}
