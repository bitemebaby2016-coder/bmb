// ============================================
// Bite Me Baby — ReviewCarouselSection (UI v5)
// Social proof as a horizontal carousel (auto-slide, pause on interaction).
// Reuses the existing CustomerReviewCard (2.5D glass + 3D stars + mascot peek).
//
// N4 (Owner 2026-11-01 "ยุบรีวิว 2 เซกชั่น — ซ้ำสองเซกชั่น"):
//   เซกชั่น "📸 รีวิวจริงจากลูกค้า" รวมเป็นที่เดียว:
//   ① หัวข้อ + คารูเซลข้อความรีวิว (คัดจากสกรีนช็อตจริง — socialProofReviews)
//   ② อัลบั้มรูปสกรีนช็อตจริง 32 ใบ (ย้ายมาจาก ReviewGallerySection —
//      คงคลาส review-gallery* + lightbox + showAll เดิมทุกประการ)
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HomeReview, Product, OrderMode } from '@/types'
import { CustomerReviewCard } from '@/components/CustomerReviewCard'
import { HorizontalCarousel } from './HorizontalCarousel'
import { MascotBadge } from '@/components/MascotBadge'
import { REAL_REVIEW_PHOTOS } from '@/lib/realReviews'

interface ReviewCarouselSectionProps {
  reviews: HomeReview[]
  products: Product[]
  /** Preserves the existing review→cart deep-link flow (add item then navigate by mode). */
  onReviewCta?: (review: HomeReview) => void
}

// PERF (เดิมจาก ReviewGallerySection): render 12 thumbs ก่อน — ที่เหลือกดดูต่อ (DOM เบา)
const INITIAL_COUNT = 12

export function ReviewCarouselSection({ reviews, products, onReviewCta }: ReviewCarouselSectionProps) {
  const [open, setOpen] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const productMap = new Map((products || []).map((p) => [p.id, p]))
  const items = reviews.map((r) => {
    const product = productMap.get(r.relatedProduct?.id ?? '') ?? r.relatedProduct
    const mode: OrderMode = (product?.available_preorder ?? product?.is_preorder) ? 'pre-order' : 'same-day'
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

  const visiblePhotos = showAll ? REAL_REVIEW_PHOTOS : REAL_REVIEW_PHOTOS.slice(0, INITIAL_COUNT)

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="home-reviews-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-reviews-heading" className="text-xl font-display font-bold text-brand-accent flex items-center gap-2">
          {/* R50 (Owner 2026-11-01): ยุบรวม + ชื่อใหม่ = รีวิวจริงจากลูกค้า */}
          <span>📸 รีวิวจริงจากลูกค้า</span>
            <MascotBadge pose="reviewing" size="sm" alt="น้อง Bite อ่านรีวิวจริง" className="section-float-mascot" />
          <img
            src="/Logo_Sticker_Circle.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="review-float-logo"
            aria-hidden="true"
          />
        </h2>
        <Link to="/reviews" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
      </div>
      <h3 className="sr-only">รีวิวจากลูกค้าจริง</h3>
      {items.length > 0 && (
        <HorizontalCarousel
          items={items}
          aria-label="รีวิวจากลูกค้า เลื่อนได้"
          auto
          intervalMs={8000}
        />
      )}

      {/* N4: อัลบั้มรูปสกรีนช็อตจริง (ย้ายมาจาก ReviewGallerySection — คงคลาส/behavior เดิม) */}
      {REAL_REVIEW_PHOTOS.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-brand-accent">รูปรีวิวจริงจากลูกค้า</p>
            <span className="text-sm text-brand-muted">{REAL_REVIEW_PHOTOS.length} รูป</span>
          </div>
          <div className="review-gallery" role="list">
            {visiblePhotos.map((p) => (
              <button
                key={p.src}
                type="button"
                role="listitem"
                className="review-gallery-item"
                onClick={() => setOpen(p.src)}
                aria-label={p.alt}
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  width={640}
                  height={800}
                  className="review-gallery-img"
                />
              </button>
            ))}
          </div>
          {!showAll && REAL_REVIEW_PHOTOS.length > INITIAL_COUNT && (
            <button
              type="button"
              className="btn btn-outline btn-sm mt-3"
              onClick={() => setShowAll(true)}
            >
              แสดงรีวิวทั้งหมด {REAL_REVIEW_PHOTOS.length} รูป ↓
            </button>
          )}
          {open && (
            <div
              className="review-gallery-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="รูปรีวิวขยาย"
              onClick={() => setOpen(null)}
            >
              <img src={open} alt="รีวิวจริงจากลูกค้า (ขยาย)" className="review-gallery-full" loading="eager" />
              <button type="button" className="review-gallery-close" onClick={() => setOpen(null)} aria-label="ปิดรูป">
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}