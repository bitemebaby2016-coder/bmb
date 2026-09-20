// ============================================
// Bite Me Baby — HomeBanner (promotional ad strip on the homepage)
// The store's current advertising promo (admin flags a promotion "Show as Home
// banner"). Customers can dismiss it (stored per promo id in localStorage).
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'

export interface HomeBannerPromo {
  id: string
  title: string
  description?: string
  coupon?: string
  image?: string
}

function dismissKey(id: string): string {
  return 'bmb_banner_dismiss_' + id
}

export function HomeBanner({ promo }: { promo: HomeBannerPromo | null }) {
  const [dismissed, setDismissed] = useState(false)
  if (!promo || !promo.id) return null
  if (dismissed) return null
  try {
    if (localStorage.getItem(dismissKey(promo.id))) return null
  } catch { /* ignore */ }

  const style = promo.image
    ? { backgroundImage: `url(${promo.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } as React.CSSProperties
    : undefined

  return (
    <div className="home-banner" style={style} data-testid="home-banner" aria-label={promo.title}>
      {style && <div className="home-banner-shade" aria-hidden="true" />}
      <div className="home-banner-content">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">📢</span>
          <span className="home-banner-title">{promo.title}</span>
        </div>
        {promo.description && <p className="text-sm text-white/90">{promo.description}</p>}
        <div className="flex items-center gap-3">
          {promo.coupon && (
            <span className="font-mono text-xs bg-white/95 text-amber-900 px-2 py-0.5 rounded-full">Code: {promo.coupon}</span>
          )}
          <Link to="/promotions" className="text-sm font-semibold underline">See deal →</Link>
        </div>
      </div>
      <button
        type="button"
        className="home-banner-close"
        aria-label="Close promotion"
        onClick={() => {
          try { localStorage.setItem(dismissKey(promo.id), '1') } catch { /* ignore */ }
          setDismissed(true)
        }}
      >
        ✕
      </button>
    </div>
  )
}