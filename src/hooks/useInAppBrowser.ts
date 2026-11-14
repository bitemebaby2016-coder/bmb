// ============================================
// Bite Me Baby — In-App Browser Detection Hook
// ============================================
// ตรวจจับ Facebook In-App Browser (FB WebView) และให้ handler สำหรับเปิดลิงก์นอก
// Native click handler เท่านั้น (ไม่ auto-redirect ตอนโหลด)
// เพิ่ม: PWA install prompt handling

import { useEffect, useState, useCallback, useRef } from 'react'

// Type for BeforeInstallPromptEvent (not in standard lib.dom.d.ts)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export type InAppPlatform = 'facebook' | 'line' | 'instagram' | 'other'

// R100e (Owner 2026-11-14 "ลิงก์ในข้อความ FB ต่อออกไป = ไม่มีป๊อปอัพสีส้มเลย"):
// สาเหตุที่แท้จริง — เดิม dismiss เก็บค่า '1' ถาวรใน localStorage ไม่มีวันหมดอายุ
// → ลูกค้ากด "เข้าใจแล้ว" ครั้งเดียว = แบนเนอร์หายตลอดชีวิตเครื่องทุกลิงก์ถัดไป
//   (แบนเนอร์ = ประตูเดียวที่พา ?cart= ไป Chrome — ปิดถาวร = สายส่งต่อตายทั้งร้าน)
// → แก้: ① ปิดมีอายุ 24 ชม. (ค่าเก่าแบบ '1' ถือว่าหมดอายุทันที — ทุกคนเห็นแบนเนอร์อีกครั้ง)
//        ② ลิงก์ตะกร้าใหม่ (?cart= ใน URL) มีสิทธิ์แจ้งเสมอ — ละเว้น dismissed + เคลียร์ค่าเก่า
const DISMISS_KEY = 'bmb:inapp:dismissed'
const DISMISS_TTL = 24 * 60 * 60_000

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    if (raw === '1') {
      // ค่าเก่าก่อน R100e = ปิดถาวรแบบไม่มีอายุ — ถือว่าหมดอายุ + ลบทิ้ง
      localStorage.removeItem(DISMISS_KEY)
      return false
    }
    const at = Number((JSON.parse(raw) as { at?: unknown }).at)
    const suppressed = Number.isFinite(at) && Date.now() - at < DISMISS_TTL
    if (!suppressed) localStorage.removeItem(DISMISS_KEY)
    return suppressed
  } catch {
    return false // localStorage ถูกบล็อก = ไม่มีประวัติปิด = โชว์แบนเนอร์ปกติ
  }
}

function detectPlatform(ua: string): InAppPlatform {
  if (/LINE\//i.test(ua)) return 'line'
  if (/Instagram\//i.test(ua)) return 'instagram'
  if (/FBAV|FB_IAB|FBAN|FBBV/i.test(ua)) return 'facebook'
  return 'other'
}

export function useInAppBrowser() {
  const [isFB, setIsFB] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  // lazy initializer: sync ก่อน effect ใด ๆ — Layout strip ?cart= หลัง fetch เสมอ
  // จึงการันตีว่าเห็น param ก่อนหาย (ใช้กำหนด "สิทธิ์แจ้ง" ของลิงก์ตะกร้าใหม่)
  const [hasCartParam] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has('cart')
    } catch {
      return false
    }
  })

  const detectedPlatform = useRef<InAppPlatform>('other')
  const [platform, setPlatform] = useState<InAppPlatform>('other')

  useEffect(() => {
    // ตรวจจับ FB/LINE/IG In-App Browser (UA เท่านั้น)
    const ua = navigator.userAgent
    const fbUA = /FBAV|FB_IAB|FBAN|FBBV|LINE\/|Instagram\//i.test(ua)
    setIsFB(fbUA)
    detectedPlatform.current = detectPlatform(ua)
    setPlatform(detectedPlatform.current)

    // R100e: โหลด dismissed state — มีอายุ 24 ชม. + ลิงก์ตะกร้าใหม่ (?cart=) ละเว้นเสมอ
    if (hasCartParam) {
      try { localStorage.removeItem(DISMISS_KEY) } catch { /* ignore */ }
      setDismissed(false)
    } else {
      setDismissed(isDismissed())
    }

    // PWA install prompt handling
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      installPromptRef.current = e
      setInstallPrompt(e)
    }
    const handleAppInstalled = () => {
      installPromptRef.current = null
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ at: Date.now() })) } catch {}
    setDismissed(true)
  }, [])

  const openExternally = useCallback((url: string) => {
    // ต้องเรียกจาก native click handler (onClick) เท่านั้น
    const ua = navigator.userAgent
    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad/i.test(ua)

    if (isAndroid) {
      // Intent URL สำหรับเปิด Chrome โดยตรง
      const cleanUrl = url.replace(/^https?:\/\//, '')
      const intent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;end`
      window.location.href = intent
    } else if (isIOS) {
      // iOS: copy link + แสดง toast แทน alert (popup blocker บล็อก alert)
      navigator.clipboard?.writeText(url).catch(() => {})
      const el = document.createElement('div')
      el.className = 'toast border bg-blue-50 text-blue-800 border-blue-200 cursor-pointer'
      el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 16px;border-radius:8px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)'
      el.textContent = 'คัดลอกลิงก์แล้ว — กด ⋯ มุมบนขวา → "เปิดใน Safari"'
      el.onclick = () => el.remove()
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 4000)
    } else {
      // Desktop/อื่นๆ: เปิดแท็บใหม่
      window.open(url, '_blank')
    }
  }, [])

  const installApp = useCallback(async () => {
    const prompt = installPromptRef.current
    if (!prompt) return false
    try {
      await prompt.prompt()
      const result = await prompt.userChoice
      if (result.outcome === 'accepted') {
        installPromptRef.current = null
        setInstallPrompt(null)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  return { isFB, dismissed, dismiss, openExternally, installPrompt: installPromptRef.current, installApp, canInstall: !!installPromptRef.current, platform }
}