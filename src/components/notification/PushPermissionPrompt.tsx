// ============================================
// Bite Me Baby — PushPermissionPrompt (R49 · DoD "Permission UI 3D Claymation")
// ============================================
// ป๊อปอัปขอสิทธิ์ Web Push สไตล์ claymation (น้อง Bite + การ์ดดินน้ำมันนูน):
//   - แสดงครั้งเดียว/เครื่อง · เลื่อน = จำ 7 วัน · ไม่ยัดถ้า permission ถูกบล็อกแล้ว
//   - ปุ่ม "รับการแจ้งเตือนสถานะอาหาร" = enablePush() จาก pushService (transport ตรง)
//   - R70: auto-heal กรณี permission granted แต่ไม่เคย subscribe + gate เฉพาะ role ลูกค้า
// ============================================

import { useEffect, useState } from 'react'
import { enablePush, getPushPermissionState, getCurrentPushSubscription } from '@/lib/pushService'
import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'

const DISMISS_KEY = 'bmb:push-prompt-dismissed-at'
const DISMISS_MS = 7 * 24 * 3600 * 1000

function isPushCapable(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    )
  } catch { return false }
}

function shouldShow(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (!isPushCapable()) return false
    if (Notification.permission !== 'default') return false
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return !at || Date.now() - at > DISMISS_MS
  } catch { return false }
}

function markDismissed(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode = ไม่เซฟ ก็ไม่เป็นไร */ }
}

/** ข้อความ error ที่บอกทางแก้ได้จริง (R70: เดิมขึ้น code ดิบ ERR_*) */
function pushErrorCopy(error: string): string {
  if (error === 'ERR_PERMISSION_DENIED') return 'เบราว์เซอร์บล็อกการแจ้งเตือน — เปิดสิทธิ์ที่ไอคอนกุญแจข้างที่อยู่ URL แล้วลองใหม่'
  if (error === 'ERR_PUSH_DISABLED') return 'ยังไม่ได้เปิดใช้งาน Push โดยผู้ดูแลระบบ — แจ้งแอดมินเปิดที่ตั้งค่าการแจ้งเตือนของร้าน'
  if (error === 'ERR_NO_VAPID_KEY') return 'ระบบยังไม่มีคีย์แจ้งเตือน (VAPID) — แจ้งแอดมินตั้งค่าก่อนใช้งาน'
  if (error === 'ERR_NO_SERVICE_WORKER') return 'ยังไม่มี Service Worker — ลองรีเฟรชหน้า (หรือติดตั้งแอป) แล้วลองใหม่'
  return 'เปิดการแจ้งเตือนไม่สำเร็จ: ' + error
}

export function PushPermissionPrompt() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  // R64 (Owner: กด "เปิดการแจ้งเตือน" บนหน้า /login = ล็อกอินไม่อยู่ → register ล้ม → ไม่มี push เลย):
  // ห้ามเด้งบนหน้าที่ยังไม่มี session — รอจนล็อกอินแล้ว (register ใช้ JWT ของลูกค้า)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // R70: แอดมินไม่มีแถว customers = register_push_subscription ล้มตามดีไซน์ ·
  // ไรเดอร์มีสวิตช์ของตัวเองที่ /rider (audience=driver) — ป๊อปอัปนี้สำหรับ "ลูกค้า" เท่านั้น
  const role = useAuthStore((s) => s.role)
  const canPrompt = role == null || role === 'customer'

  useEffect(() => {
    if (!isAuthenticated || !canPrompt) {
      setShow(false)
      return
    }
    if (!isPushCapable()) return
    let cancelled = false
    let timer: number | undefined
    void (async () => {
      try {
        if (Notification.permission === 'granted') {
          // R70 (บั๊กที่ทำให้ push "ไม่เคยใช้งานได้"): เคยได้สิทธิ์แต่ไม่เคย subscribe/
          // register (เช่น native dialog เด้งเองแล้วกดอนุญาต) = เงียบสนิทถาวร —
          // auto-heal: subscribe+register ให้เองเงียบ ๆ ครั้งเดียว
          const sub = await getCurrentPushSubscription()
          if (!cancelled && !sub) {
            const r = await enablePush('customer')
            if (r.ok && !cancelled) showToast('🔔 เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว — รอรับข่าวออเดอร์ได้เลย', 'success')
          }
          return
        }
        if (!shouldShow()) return
        // รอให้หน้าโหลดนิ่งก่อน — ไม่เด้งทันทีที่เข้าเว็บ (natural prompt)
        timer = window.setTimeout(() => {
          if (!cancelled && getPushPermissionState() === 'default') setShow(true)
        }, 6000)
      } catch {
        /* ไม่เด้งอะไรถ้าตรวจไม่ได้ */
      }
    })()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [isAuthenticated, canPrompt])

  if (!show) return null

  function accept() {
    setBusy(true)
    void enablePush('customer')
      .then((r) => {
        if (r.ok) showToast('🔔 เปิดการแจ้งเตือนสถานะอาหารแล้ว — รอรับข่าวออเดอร์ได้เลย', 'success')
        else showToast(pushErrorCopy(r.error), 'error')
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