// ============================================
// Bite Me Baby — Floating Ad Banners (overlay)
// Replaces the old inline home strip: promos flagged `is_banner` float in as an
// overlay card stack (max 2 at once, promo data pulled from the real DB rows
// below the creative). Each banner has a prominent ✕ — dismissing stores the
// promo id in localStorage (per-promo) so it never pops up repeatedly.
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'

export interface FloatingBannerPromo {
  id: string
  title: string
  description?: string
  coupon?: string
  image?: string
}

function dismissKey(id: string): string {
  return 'bmb_banner_dismiss_' + id
}

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(dismissKey(id)) === '1'
  } catch { return false }
}

// AI-CLEANUP: mock banner asset removed — banners without a creative render a
// branded CSS gradient placeholder instead (dynamic promo data from DB only).

export function FloatingAdBanners({ promos }: { promos: FloatingBannerPromo[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  // max 2 banners; skip already-dismissed ones
  const visible = (promos || [])
    .filter((p) => p.id && !dismissedIds.has(p.id) && !isDismissed(p.id))
    .slice(0, 2)

  if (visible.length === 0) return null

  function dismiss(id: string) {
    try { localStorage.setItem(dismissKey(id), '1') } catch { /* ignore */ }
    dismissedIds.add(id)
    setDismissedIds(new Set(dismissedIds))
  }

  return (
    <div className="flad-overlay" role="dialog" aria-modal="true" aria-label="โปรโมชั่น" data-testid="floating-ad-banners">
      {/* Backdrop: dims the page so the promo never hides menu items */}
      <div className="flad-backdrop" onClick={() => visible.forEach((p) => dismiss(p.id))} />
      <div className="flad-stack">
        {visible.map((promo) => (
          <div key={promo.id} className="flad-card" data-testid="floating-ad-banner">
          <div className="flad-media">
            {promo.image ? (
              <img
                src={promo.image}
                alt=""
                loading="lazy"
                onError={(e) => {
                  // promo.image ชี้ไฟล์ที่ไม่มีแล้ว (เช่น mock banner เดิม) → แสดง branded fallback
                  const el = e.currentTarget as HTMLImageElement
                  if (!el.dataset.fbk) { el.dataset.fbk = '1'; el.style.display = 'none'; el.parentElement?.classList.add('flad-media-fallback') }
                }}
              />
            ) : (
              <div className="flad-media flad-media-fallback" aria-hidden="true" />
            )}
          </div>
          <div className="flad-body">
            <div className="flad-title">{promo.title?.trim() || '🎉 โปรโมชั่นพิเศษจาก Bite Me Baby'}</div>
            {promo.description?.trim() && <p className="flad-desc">{promo.description}</p>}
            <div className="flad-actions">
              {promo.coupon && (
                <span className="flad-coupon" data-testid="floating-ad-coupon">Code: {promo.coupon}</span>
              )}
              <Link to="/promotions" className="flad-cta">ดูดีลเลย →</Link>
            </div>
          </div>
          <button
            type="button"
            className="flad-close"
            data-testid="floating-ad-close"
            aria-label={`ปิดปโปรโมশন ${promo.title}`}
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