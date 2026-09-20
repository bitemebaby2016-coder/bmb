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

const MOCK_BANNER_IMAGE = '/images/banners/banner-mock-1.svg'

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
    <div className="flad-stack" data-testid="floating-ad-banners" aria-label="โปรโมชั่น">
      {visible.map((promo) => (
        <div key={promo.id} className="flad-card" data-testid="floating-ad-banner">
          <div className="flad-media">
            {promo.image ? (
              <img src={promo.image} alt="" loading="lazy" />
            ) : (
              <img src={MOCK_BANNER_IMAGE} alt="" loading="lazy" />
            )}
          </div>
          <div className="flad-body">
            <div className="flad-title">{promo.title}</div>
            {promo.description && <p className="flad-desc">{promo.description}</p>}
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
  )
}