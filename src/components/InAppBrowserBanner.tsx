// ============================================
// Bite Me Baby — In-App Browser Banner
// ============================================
// แสดง banner แจ้งเตือนเมื่อเปิดใน FB WebView + ปุ่มเปิดนอก + dismiss + ปุ่มติดตั้งแอป
// R90 (Owner 2026-11-11): ลิงก์จาก AI พังซ้ำ — แก้ decode cart ผิดวิธี + strip ?cart= ก่อนเปิดภายนอก
//   • ใช้ decodeCartParam() ตรงกับ Layout.tsx (ไม่ใช้ atob แบบ raw ที่ขาด padding)
//   • เก็บ raw cart param ไว้ localStorage ก่อน strip → สร้าง URL ใหม่พร้อม ?cart= เมื่อเปิด Chrome
// ============================================

import { useEffect, useState, useCallback } from 'react'
import { useInAppBrowser } from '@/hooks/useInAppBrowser'
import { decodeCartParam } from '@/lib/cartDeepLink'

const CART_RESUME_KEY = 'bmb:cart-resume'

interface CartResumeData {
  raw: string
  items: number
}

export function InAppBrowserBanner({ children }: { children: React.ReactNode }) {
  const { isFB, dismissed, dismiss, openExternally, installApp, canInstall } = useInAppBrowser()

  if (!isFB || dismissed) return <>{children}</>

  const currentUrl = window.location.href
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const intentUrl = isAndroid
    ? `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;s.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
    : null

  // Cart continuity: อ่าน + decode ?cart= แล้วเก็บลง localStorage ก่อน strip โดย Layout.tsx
  const urlParams = new URLSearchParams(window.location.search)
  const hasCartParam = urlParams.has('cart')
  const [cartItems, setCartItems] = useState<number>(0)
  const [rawCart, setRawCart] = useState<string | null>(null)

  useEffect(() => {
    if (!hasCartParam) return
    const raw = urlParams.get('cart')!
    if (!raw) return
    try {
      const items = decodeCartParam(raw)
      if (items && items.length > 0) {
        setCartItems(items.length)
        setRawCart(raw)
        try {
          localStorage.setItem(CART_RESUME_KEY, JSON.stringify({ raw, items: items.length }))
          console.log('[InAppBanner] Cart saved for resume:', items.length)
        } catch { /* localStorage blocked */ }
      } else {
        console.warn('[InAppBanner] decodeCartParam returned empty/unvalidated for length', raw?.slice(0, 20))
      }
    } catch (e) {
      console.error('[InAppBanner] decodeCartParam error:', e)
    }
  }, [hasCartParam])

  const handleOpenExternal = useCallback(() => {
    // สร้าง URL พร้อม ?cart= จาก localStorage (กัน strip โดย Layout.tsx)
    let targetUrl = currentUrl
    if (rawCart) {
      try {
        const u = new URL(currentUrl)
        u.searchParams.set('cart', rawCart)
        targetUrl = u.toString()
      } catch { /* fallback: keep currentUrl */ }
    }
    openExternally(targetUrl)
  }, [currentUrl, rawCart, openExternally])

  console.log('[InAppBanner] intentURL:', intentUrl, 'search:', window.location.search, 'cart:', cartItems)

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-3 animate-slide-down"
        role="banner"
        aria-live="polite"
        data-testid="inapp-banner"
      >
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">📱</span>
            <div>
              <p className="font-semibold">กำลังเปิดใน Facebook</p>
              {cartItems > 0 ? (
                <p className="text-xs opacity-90">พบรายการ {cartItems} รายการในตะกร้า — จะไปเติมใน Chrome ให้ครับ</p>
              ) : (
                <>
                  <p className="text-xs opacity-90">บางฟีเจอร์ทำงานไม่เต็ม (Push, Bluetooth, ติดตั้งแอป)</p>
                  <p className="text-xs opacity-90 mt-1">ลิงก์ที่มี ?cart= จากแชท AI จะเติมตะกร้าอัตโนมัติเมื่อเปิด Chrome</p>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {intentUrl && (
              <a
                href={intentUrl}
                className="bg-white text-amber-700 font-bold px-4 py-2 rounded-lg shadow"
                data-testid="inapp-open-external"
              >
                เปิดใน Chrome
              </a>
            )}
            {!intentUrl && (
              <button
                type="button"
                className="bg-white text-amber-700 font-bold px-4 py-2 rounded-lg shadow"
                onClick={handleOpenExternal}
                data-testid="inapp-open-external"
              >
                เปิดในเบราว์เซอร์ภายนอก
              </button>
            )}
            {canInstall && (
              <button
                type="button"
                className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg shadow"
                onClick={installApp}
                data-testid="inapp-install-app"
              >
                📥 ติดตั้งแอป
              </button>
            )}
            <button
              type="button"
              className="text-white opacity-80 hover:opacity-100 text-sm underline"
              onClick={dismiss}
              data-testid="inapp-dismiss"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      </div>

      <div className="h-20 lg:h-24" aria-hidden="true" />

      {children}
    </>
  )
}