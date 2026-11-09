// ============================================
// Bite Me Baby — In-App Browser Banner
// ============================================
// แสดง banner แจ้งเตือนเมื่อเปิดใน FB WebView + ปุ่มเปิดนอก + dismiss
// ใช้ wrap ใน App.tsx รอบ Routes

import { useInAppBrowser } from '@/hooks/useInAppBrowser'

export function InAppBrowserBanner({ children }: { children: React.ReactNode }) {
  const { isFB, dismissed, dismiss, openExternally } = useInAppBrowser()

  if (!isFB || dismissed) return <>{children}</>

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
              <p className="text-xs opacity-90">บางฟีเจอร์ทำงานไม่เต็ม (Push, Bluetooth, ติดตั้งแอป)</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="bg-white text-amber-700 font-bold px-4 py-2 rounded-lg shadow"
              onClick={() => openExternally(window.location.href)}
              data-testid="inapp-open-external"
            >
              เปิดใน Chrome / Safari
            </button>
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

      {/* Spacer เพื่อไม่ให้เนื้อหาถูกบัง */}
      <div className="h-20 lg:h-24" aria-hidden="true" />

      {children}
    </>
  )
}