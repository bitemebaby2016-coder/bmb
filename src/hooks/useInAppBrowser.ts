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

export function useInAppBrowser() {
  const [isFB, setIsFB] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

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

  return { isFB, dismissed, dismiss, openExternally, installPrompt: installPromptRef.current, installApp, canInstall: !!installPromptRef.current }
}