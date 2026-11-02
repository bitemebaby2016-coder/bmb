// ============================================
// Bite Me Baby — Floating Ad Banners (overlay)
// Replaces the old inline home strip: promos flagged `is_banner` float in as an
// overlay card stack (max 2 at once, promo data pulled from the real DB rows
// below the creative). Each banner has a prominent ✕ — dismissing stores the
// promo id in sessionStorage (per-promo, D03: current session only) so it never
// pops up again this session even when the promo query returns a different
// order or the next row enters the limited slice.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SITE_COPY } from '@/lib/homePopular'

const DEFAULT_AD_NOTICE = DEFAULT_SITE_COPY.adNotice

export interface FloatingBannerPromo {
  id: string
  title: string
  description?: string
  coupon?: string
  image?: string
  /** R50: ลิงก์จริงต่อรายการ (ค่าเริ่มต้น = /promotions) */
  to?: string
}

function dismissKey(id: string): string {
  return 'bmb_banner_dismiss_' + id
}

function isDismissed(id: string): boolean {
  try {
    return sessionStorage.getItem(dismissKey(id)) === '1'
  } catch { return false }
}

// D03: deterministic selection — filter dismissed promos, KEEP INPUT ORDER
// (R50: รายการ = ประกาศล่าสุด (ใหม่ก่อน) ตามด้วยโปรโมชั่น — ต้องนับเป็น "ล่าสุดไม่เกิน 2")
export function pickVisibleBannerPromos(
  promos: FloatingBannerPromo[],
  dismissed: ReadonlySet<string>,
): FloatingBannerPromo[] {
  return [...(promos || [])]
    .filter((p) => p.id && !dismissed.has(p.id) && !isDismissed(p.id))
    .slice(0, 2)
}

// AI-CLEANUP: mock banner asset removed — banners without a creative render a
// branded CSS gradient placeholder instead (dynamic promo data from DB only).

export function FloatingAdBanners({ promos, notice }: { promos: FloatingBannerPromo[]; notice?: string }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  // R55 (Owner 2026-11-02): ภาพโปรโมตที่แอดมินเจน/เลือกไว้ใน AI Studio (business_settings.floating_ad_image)
  //   = แทนมาสคอตในโฆษณาลอย · แอดมินบราวซ์เลือกจากอัลบั้ม (ปุ่ม "ตั้งเป็นโฆษณาลอย") · ว่าง = เดิมตามรูปโปรโมชั่น/มาสคอต
  const [floatImg, setFloatImg] = useState('')
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'floating_ad_image').maybeSingle()
        const v = (data as { value?: unknown } | null)?.value
        if (alive && !error && typeof v === 'string' && v) setFloatImg(v)
      } catch { /* zero-fake — ไม่มีค่า = ใช้_behavior เดิม */ }
    })()
    return () => { alive = false }
  }, [])
  // R50: "ประกาศล่าสุด" ย้ายจากหน้าจอส่วนล่างขึ้นมาอยู่รวมกับโปรโมชั่นที่นี่
  // (rpc เดิมกับ MarketingFeedSection · newest-first · ล้มเหลว/ว่าง = เงียบ zero-fake)
  const [announcements, setAnnouncements] = useState<FloatingBannerPromo[]>([])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase.rpc('marketing_feed_posts', { p_limit: 3 })
        if (alive && !error && Array.isArray(data)) {
          setAnnouncements(
            (data as Array<{ id: string; title: string; body: string | null }>).slice(0, 2).map((p) => ({
              id: 'ann-' + p.id,
              title: '📣 ' + (p.title || 'ประกาศจากร้าน'),
              description: (p.body || '').slice(0, 140) || undefined,
              to: '/promotions',
            })),
          )
        }
      } catch { /* เงียบ — ไม่มี rpc/ไม่มีโพสต์ = โชว์เฉพาะโปรโมชั่น */ }
    })()
    return () => { alive = false }
  }, [])

  // ประกาศ (ใหม่ก่อน) + โปรโมชั่น → ตัด dismissed → สูงสุด 2 (นับรวม)
  const merged = [...announcements, ...(promos || [])]
  // max 2 banners; skip already-dismissed ones (state + sessionStorage)
  const visible = pickVisibleBannerPromos(merged, dismissedIds)
  const visibleKey = visible.map((p) => p.id).join(',')

  function dismiss(id: string) {
    try { sessionStorage.setItem(dismissKey(id), '1') } catch { /* ignore */ }
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  // D03/keyboard: Esc dismisses the currently visible banners (parity with ✕).
  // Only active while at least one banner is on screen; removed on dismiss.
  useEffect(() => {
    if (!visibleKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      visibleKey.split(',').filter(Boolean).forEach((id) => dismiss(id))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visibleKey])

  if (visible.length === 0) return null

  return (
    <div className="flad-overlay" role="dialog" aria-modal="true" aria-label="โปรโมชั่น" data-testid="floating-ad-banners">
      {/* Backdrop: dims the page so the promo never hides menu items */}
      <div className="flad-backdrop" onClick={() => visible.forEach((p) => dismiss(p.id))} />

      <div className="flad-stack">
        {visible.map((promo) => (
          <div key={promo.id} className="flad-card" data-testid="floating-ad-banner">
          <div className="flad-media">
            {(promo.image || floatImg) ? (
              <>
                <img
                  src={promo.image || floatImg}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    // media ชี้ไฟล์ที่ไม่มีแล้ว → branded fallback (และตัด mascot ประกอบออกด้วย)
                    const el = e.currentTarget as HTMLImageElement
                    if (!el.dataset.fbk) {
                      el.dataset.fbk = '1'
                      el.style.display = 'none'
                      el.parentElement?.classList.add('flad-media-fallback')
                      el.parentElement?.querySelector('.flad-mascot-composed')?.remove()
                    }
                  }}
                />
                {/* R55: "เอามาสคอตไปประกอบรูป" — รูปที่ยังไม่มีลายน้ำมาสคอตติดมา → ประกอบน้อง Bite ทับมุมรูป
                    (ภาพ wm-* มีมาสคอตในไฟล์อยู่แล้ว = ไม่ซ้ำ) */}
                {!String(promo.image || floatImg).includes('/wm-') && (
                  <img src="/assets/mascot/bite_recommend.webp" alt="" loading="lazy" className="flad-mascot-composed" data-testid="floating-ad-mascot" />
                )}
              </>
            ) : (
              <div className="flad-media flad-media-fallback" aria-hidden="true">
                {/* ช่องสื่อว่าง → ใส่มาสคอตน้อง Bite ทับ gradient ส้ม ไม่ทิ้งบล็อกเปล่า */}
                <img src="/assets/mascot/bite_ready.webp" alt="" loading="lazy" className="flad-fallback-mascot" />
              </div>
            )}
          </div>
          <div className="flad-body">
            <div className="flad-title">{promo.title?.trim() || '🎉 โปรโมชั่นพิเศษจาก Bite Me Baby'}</div>
            {promo.description?.trim() && <p className="flad-desc">{promo.description}</p>}
            <div className="flad-actions">
              {promo.coupon && (
                <span className="flad-coupon" data-testid="floating-ad-coupon">รหัสส่วนลด: {promo.coupon}</span>
              )}
              <Link to={promo.to || '/promotions'} className="flad-cta">ดูดีลเลย →</Link>
            </div>
            {/* อักษรเตือนใต้แคมเปญ */}
            {(notice ?? DEFAULT_AD_NOTICE).trim() && (
              <p className="flad-notice" data-testid="floating-ad-notice">⚠️ {notice ?? DEFAULT_AD_NOTICE}</p>
            )}
          </div>
          <button
            type="button"
            className="flad-close"
            data-testid="floating-ad-close"
            aria-label={`ปิดโปรโมชั่น ${promo.title}`}
            onClick={() => dismiss(promo.id)}
          >
            ✕
          </button>
        </div>
      ))}
      </div>
    </div>
  )
}