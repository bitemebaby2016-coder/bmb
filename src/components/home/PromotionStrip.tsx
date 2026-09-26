// ============================================
// Bite Me Baby — PromotionStrip (UI v5)
// Compact horizontal promo cards (replace the hard-coded vertical stack).
// Data from HomePromotion contract → real admin promotions later.
// ============================================

import { Link } from 'react-router-dom'
import type { HomePromotion } from '@/types'
import { HorizontalCarousel } from './HorizontalCarousel'

export function PromotionStrip({ promotions }: { promotions: HomePromotion[] }) {
  if (promotions.length === 0) return null

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="home-promo-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-promo-heading" className="text-xl font-display font-bold text-brand-accent">
          🎟️ โปรโมชั่น
        </h2>
        <Link to="/promotions" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
      </div>
      <HorizontalCarousel
        items={promotions.map((promo) => (
          <div key={promo.id} className="promo-card card">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">🎉</span>
              <div className="min-w-0">
                <h3 className="font-bold text-brand-accent">{promo.title}</h3>
                <p className="text-sm text-brand-muted">{promo.description}</p>
                {promo.coupon && (
                  <p className="text-xs mt-1 font-mono text-brand-primary">โค้ด: {promo.coupon}</p>
                )}
              </div>
            </div>
            <Link to="/promotions" className="promo-card-cta">
              {promo.cta} →
            </Link>
          </div>
        ))}
        aria-label="โปรโมชั่น เลื่อนได้"
        auto
        intervalMs={8000}
        showIndicators={false}
      />
    </section>
  )
}