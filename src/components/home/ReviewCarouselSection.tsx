// ============================================
// Bite Me Baby — ReviewCarouselSection (UI v5)
// Social proof as a horizontal carousel (auto-slide, pause on interaction).
// Reuses the existing CustomerReviewCard (2.5D glass + 3D stars + mascot peek).
// ============================================

import { Link } from 'react-router-dom'
import type { HomeReview, Product, OrderMode } from '@/types'
import { CustomerReviewCard } from '@/components/CustomerReviewCard'
import { HorizontalCarousel } from './HorizontalCarousel'

interface ReviewCarouselSectionProps {
  reviews: HomeReview[]
  products: Product[]
  /** Preserves the existing review→cart deep-link flow (add item then navigate by mode). */
  onReviewCta?: (review: HomeReview) => void
}

export function ReviewCarouselSection({ reviews, products, onReviewCta }: ReviewCarouselSectionProps) {
  const productMap = new Map((products || []).map((p) => [p.id, p]))
  const items = reviews.map((r) => {
    const product = productMap.get(r.relatedProduct?.id ?? '') ?? r.relatedProduct
    const mode: OrderMode = product?.is_preorder ? 'pre-order' : 'same-day'
    return (
      <CustomerReviewCard
        key={r.id}
        review={{
          id: r.id,
          customerName: r.displayName,
          rating: r.rating,
          comment: r.text,
          source: r.source,
          sourceLabel: r.sourceLabel,
          dateLabel: r.dateLabel,
          foodName: r.relatedProductName ?? '',
          productId: r.relatedProduct?.id ?? '',
        }}
        product={product}
        mode={mode}
        deepLinkTo={mode === 'pre-order' ? '/checkout?mode=pre-order' : '/cart?mode=same-day'}
        onCta={() => onReviewCta?.(r)}
      />
    )
  })

  if (items.length === 0) return null

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="home-reviews-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-reviews-heading" className="text-xl font-display font-bold text-brand-accent flex items-center gap-2">
          ⭐ รีวิวจากลูกค้าจริง
        </h2>
        <Link to="/reviews" className="text-sm text-brand-primary font-medium hover:underline">รีวิวทั้งหมด →</Link>
      </div>
      <HorizontalCarousel
        items={items}
        aria-label="รีวิวจากลูกค้า เลื่อนได้"
        auto
        intervalMs={5000}
      />
    </section>
  )
}