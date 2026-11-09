// ============================================
// Bite Me Baby — In-App Browser Detection Hook
// ============================================
// ตรวจจับ Facebook In-App Browser (FB WebView) และให้ handler สำหรับเปิดลิงก์นอก
// Native click handler เท่านั้น (ไม่ auto-redirect ตอนโหลด)

import { useEffect, useState, useCallback } from 'react'

export function useInAppBrowser() {
  const [isFB, setIsFB] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // ตรวจจับ FB WebView: user agent + heuristic
    const ua = navigator.userAgent
    const fbUA = /FBAV|FB_IAB|FBAN|FBBV/i.test(ua)
    // Heuristic: FB WebView มักมี viewport เล็กกว่า screen จริง
    const viewportMismatch = typeof window !== 'undefined' && window.innerWidth < window.screen.width * 0.95
    const detected = fbUA || viewportMismatch
    setIsFB(detected)

    // โหลด dismissed state
    try {
      const d = localStorage.getItem('bmb:inapp:dismissed')
      setDismissed(d === '1')
    } catch { /* localStorage blocked */ }
  }, [])

  const dismiss = useCallback(() => {
    try { localStorage.setItem('bmb:inapp:dismissed', '1') } catch {}
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
      // iOS: copy link + แสดง guide
      navigator.clipboard?.writeText(url).catch(() => {})
      alert('คัดลอกลิงก์แล้ว — กด ⋯ (สามจุด) มุมบนขวา → "เปิดใน Safari"')
    } else {
      // Desktop/อื่นๆ: เปิดแท็บใหม่
      window.open(url, '_blank')
    }
  }, [])

  return { isFB, dismissed, dismiss, openExternally }
}