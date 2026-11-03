// ============================================
// Bite Me Baby — PushPermissionPrompt (R49 · DoD "Permission UI 3D Claymation")
// ============================================
// ป๊อปอัปขอสิทธิ์ Web Push สไตล์ claymation (น้อง Bite + การ์ดดินน้ำมันนูน):
//   - แสดงครั้งเดียว/เครื่อง · เลื่อน = จำ 7 วัน · ไม่ยัดถ้า permission ถูกบล็อกแล้ว
//   - ปุ่ม "รับการแจ้งเตือนสถานะอาหาร" = enablePush() ตัวเดิมกับ Notification Center
//     (ไม่เขียน transport ใหม่ — ใช้ notificationManager re-export)
// ============================================

import { useEffect, useState } from 'react'
import { enablePush, getPushPermissionState } from '@/lib/notifications/notificationManager'
import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'

const DISMISS_KEY = 'bmb:push-prompt-dismissed-at'
const DISMISS_MS = 7 * 24 * 3600 * 1000

function shouldShow(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
    if (Notification.permission !== 'default') return false
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return !at || Date.now() - at > DISMISS_MS
  } catch { return false }
}

function markDismissed(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode = ไม่เซฟ ก็ไม่เป็นไร */ }
}

export function PushPermissionPrompt() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  // R64 (Owner: กด "เปิดการแจ้งเตือน" บนหน้า /login = ล็อกอินไม่อยู่ → register ล้ม → ไม่มี push เลย):
  // ห้ามเด้งบนหน้าที่ยังไม่มี session — รอจนล็อกอินแล้ว (register ใช้ JWT ของลูกค้า)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      setShow(false)
      return
    }
    if (!shouldShow()) return
    // รอให้หน้าโหลดนิ่งก่อน — ไม่เด้งทันทีที่เข้าเว็บ (natural prompt)
    const t = window.setTimeout(() => {
      if (getPushPermissionState() === 'default') setShow(true)
    }, 6000)
    return () => window.clearTimeout(t)
  }, [isAuthenticated])

  if (!show) return null

  function accept() {
    setBusy(true)
    void enablePush('customer')
      .then((r) => {
        if (r.ok) showToast('🔔 เปิดการแจ้งเตือนสถานะอาหารแล้ว — รอรับข่าวออเดอร์ได้เลย', 'success')
        else if (r.error === 'ERR_PERMISSION_DENIED') showToast('เบราว์เซอร์บล็อกการแจ้งเตือน — เปิดสิทธิ์ที่ไอคอนกุญแจข้างที่อยู่ URL แล้วลองใหม่', 'error')
        else showToast('เปิดการแจ้งเตือนไม่สำเร็จ: ' + r.error, 'error')
      })
      .finally(() => { setBusy(false); markDismissed(); setShow(false) })
  }

  function later() {
    markDismissed()
    setShow(false)
  }

  return (
    <div
      data-testid="push-permission-prompt"
      role="dialog"
      aria-label="ขอสิทธิ์การแจ้งเตือน"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[70] w-[min(92vw,400px)]"
    >
      <div
        className="rounded-[28px] p-4 flex gap-3 items-center border-[3px] border-white"
        style={{
          background: 'linear-gradient(160deg, #ffd9a8 0%, #ffb35c 55%, #ff9a3d 100%)',
          boxShadow: '0 18px 34px -12px rgba(255,120,20,.55), inset 0 3px 0 rgba(255,255,255,.75), inset 0 -6px 14px rgba(180,80,0,.28)',
        }}
      >
        {/* น้อง Bite โผล่ = claymation entrance (pose จริงจาก assets/mascot) */}
        <img
          src="/assets/mascot/bite_peeking.webp"
          alt="น้อง Bite ชวนเปิดการแจ้งเตือน"
          className="w-16 h-16 object-contain drop-shadow-[0_6px_6px_rgba(120,50,0,.35)] shrink-0"
          loading="eager"
          decoding="async"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-[15px] leading-snug text-[#5b2a00]">
            🔔 รับการแจ้งเตือนสถานะอาหาร
          </p>
          <p className="text-xs text-[#7a4310] mt-0.5 leading-snug">
            รอรู้ว่าสลิปผ่าน อาหารกำลังจะถึง โดยไม่ต้องคอยเปิดเว็บ
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              data-testid="push-permission-accept"
              className="btn btn-primary btn-sm flex-1 !min-h-0 py-1.5 text-[13px] disabled:opacity-60"
            >
              {busy ? 'กำลังเปิด…' : 'เปิดการแจ้งเตือน'}
            </button>
            <button
              type="button"
              onClick={later}
              data-testid="push-permission-later"
              className="btn btn-outline btn-sm !min-h-0 py-1.5 text-[13px] bg-white/70"
            >
              ไว้ทีหลัง
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}