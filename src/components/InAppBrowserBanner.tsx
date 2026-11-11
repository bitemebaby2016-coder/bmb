// ============================================
// Bite Me Baby — In-App Browser Banner
// ============================================
// แสดง banner แจ้งเตือนเมื่อเปิดใน FB WebView + ปุ่มเปิดนอก + dismiss + ปุ่มติดตั้งแอป

import { useInAppBrowser } from '@/hooks/useInAppBrowser'

export function InAppBrowserBanner({ children }: { children: React.ReactNode }) {
  const { isFB, dismissed, dismiss, openExternally, installApp, canInstall } = useInAppBrowser()

  if (!isFB || dismissed) return <>{children}</>

  const currentUrl = window.location.href
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const intentUrl = isAndroid
    ? `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;s.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
    : null

  // Cart continuity: decode ?cart= param from URL search
  const urlParams = new URLSearchParams(window.location.search)
  const hasCartParam = urlParams.has('cart')
  let cartItems = 0
  if (hasCartParam) {
    try {
      const raw = urlParams.get('cart')!
      const decoded = raw.replace(/-/g, '+').replace(/_/g, '/')
      const d = JSON.parse(atob(decoded))
      cartItems = d.items?.length || 0
      console.log('[InAppBanner] Cart items found:', cartItems)
    } catch {
      console.log('[InAppBanner] Cart decode failed')
    }
  }
  console.log('[InAppBanner] intentURL:', intentUrl, 'search:', window.location.search)

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
              {hasCartParam && cartItems > 0 ? (
                <p className="text-xs opacity-90">กำลังนำรายการ {cartItems} รายการในตะกร้า ไปยัง Chrome...</p>
              ) : hasCartParam ? (
                <p className="text-xs opacity-90">พบ ?cart= parameter แต่ไม่สามารถอ่านสินค้าได้</p>
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
                onClick={() => openExternally(currentUrl)}
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