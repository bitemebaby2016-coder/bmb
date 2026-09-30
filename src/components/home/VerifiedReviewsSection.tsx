// ============================================
// Bite Me Baby — Verified Customer Reviews Section (CAT-04)
// Displays ONLY verified reviews from actual purchases (reviews table).
// Separate from Marketing Testimonials (SOCIAL_PROOF_REVIEWS static list).
// ============================================

import { Link } from 'react-router-dom'
import type { VerifiedCustomerReview, Product } from '@/types'
import { CustomerReviewCard } from '@/components/CustomerReviewCard'

interface VerifiedReviewsSectionProps {
  reviews: VerifiedCustomerReview[]
  products?: Product[]
}

export function VerifiedReviewsSection({ reviews, products }: VerifiedReviewsSectionProps) {
  if (!reviews || reviews.length === 0) return null

  const productMap = new Map(products?.map((p) => [p.id, p]) ?? [])

  const items = reviews.map((r) => {
    const product = productMap.get(r.product_id)
    return (
      <div key={r.id} className="review-card-3d">
        <div className="review-card-glass">
          {/* Verified badge */}
          <div className="flex items-center justify-between mb-2">
            <span className="review-source-badge" style={{ background: '#10B981', color: 'white' }}>
              Verified Purchase
            </span>
            <span className="review-date">{new Date(r.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>

          {/* Star rating */}
          <div className="text-amber-500 text-lg mb-2">
            {'⭐'.repeat(Math.min(5, Math.round(r.rating)))}{' '.repeat(5 - Math.min(5, Math.round(r.rating)))}
            <span className="font-bold">{r.rating.toFixed(1)}</span>
          </div>

          {/* Comment */}
          <p className="review-comment mb-2">"{r.comment}"</p>

          {/* Customer + Product info */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm">
                {r.customer_name.charAt(0)}
              </div>
              <div>
                <div className="font-medium text-sm text-brand-accent">{r.customer_name}</div>
                {r.product_name_display && (
                  <div className="text-xs text-brand-muted">
                    <Link to={`/reviews/${r.product_id}`} className="hover:underline">
                      {r.product_name_display}
                    </Link>
                  </div>
                )}
              </div>
            </div>
            
            {/* Branch context (if applicable) */}
            {r.branch_id && (
              <span className="text-xs text-brand-muted bg-gray-50 px-2 py-1 rounded">
                Branch #{r.branch_id.slice(0, 6)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  })

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="verified-reviews-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="verified-reviews-heading" className="text-xl font-display font-bold text-brand-accent flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">✓</span>
          รีวิวจากลูกค้าที่สั่งซื้อจริง
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items}
      </div>
    </section>
  )
}
