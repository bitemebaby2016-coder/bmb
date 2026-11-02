// ============================================
// Bite Me Baby — ReviewCarouselSection (UI v5)
// Social proof as a horizontal carousel (auto-slide, pause on interaction).
// Reuses the existing CustomerReviewCard (2.5D glass + 3D stars + mascot peek).
//
// N4 (Owner 2026-11-01 "ยุบรีวิว 2 เซกชั่น — ซ้ำสองเซกชั่น"):
//   เซกชั่น "📸 รีวิวจริงจากลูกค้า" รวมเป็นที่เดียว:
//   ① หัวข้อ + คารูเซลข้อความรีวิว (ข้อความคัดจากภาพจริง · โลโก้ FB/Grab สลับตาม Owner R54)
//   ② อัลบั้มรูปสกรีนช็อตจริง 32 ใบ — เปิดจากปุ่ม "ดูทั้งหมด" (modal + lightbox · ไม่โชว์ inline)
// ============================================

import { useState } from 'react'
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

// N4-R54 (Owner 2026-11-02 feedback): อัลบั้มไม่โชว์ inline — เปิดจากปุ่ม "ดูทั้งหมด" (modal + lightbox)
//   คงคลาส review-gallery* + behavior คลิกดูรูป/ปิด ไว้ทุกประการ

export function ReviewCarouselSection({ reviews, products, onReviewCta }: ReviewCarouselSectionProps) {
  const [open, setOpen] = useState<string | null>(null)
  const [albumOpen, setAlbumOpen] = useState(false)
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
          image: r.image,
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
        <button type="button" onClick={() => setAlbumOpen(true)} className="text-sm text-brand-primary font-medium hover:underline" data-testid="reviews-see-all-album">ดูทั้งหมด →</button>
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

      {/* N4-R54: อัลบั้มไม่โชว์ inline — modal เปิดจากปุ่ม "ดูทั้งหมด" ข้างหัวข้อ (Owner 2026-11-02) */}
      {albumOpen && (
        <div
          className="review-album-modal"
          role="dialog"
          aria-modal="true"
          aria-label="อัลบั้มรูปรีวิวจริงจากลูกค้า"
          onClick={() => setAlbumOpen(false)}
        >
          <div className="review-album-panel" onClick={(e) => e.stopPropagation()}>
            <div className="review-album-head">
              <p className="text-sm font-medium text-brand-accent">อัลบั้มรูปรีวิวจริงจากลูกค้า ({REAL_REVIEW_PHOTOS.length} รูป)</p>
              <button type="button" className="review-album-close" onClick={() => setAlbumOpen(false)} aria-label="ปิดอัลบั้ม">
                ✕
              </button>
            </div>
            <div className="review-gallery" role="list">
              {REAL_REVIEW_PHOTOS.map((p) => (
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
          </div>
        </div>
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
    </section>
  )
}