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
import type { HomeReview, Product, OrderMode, VerifiedCustomerReview } from '@/types'
import { CustomerReviewCard } from '@/components/CustomerReviewCard'
import { HorizontalCarousel } from './HorizontalCarousel'
import { MascotBadge } from '@/components/MascotBadge'
import { REAL_REVIEW_PHOTOS } from '@/lib/realReviews'

// R89c (Owner 2026-11-09 · มติ "ขึ้นก่อนสุด"): จำนวนรีวิวอนุมัติสูงสุดที่โชว์ — ใหม่อนุมัติขึ้นก่อน
// เกินนี้ของเก่าถูกแทนที่ออกเรื่อย (ไม่ใช่เรียงตาม rating เหมือนเดิม)
const VERIFIED_FEED_MAX = 10

interface ReviewCarouselSectionProps {
  reviews: HomeReview[]
  /**
   * R89b (Owner 2026-11-09 · มติ "ข้อ ก = รวมทั้งสองเซต"):
   * รีวิว DB ที่แอดมินอนุมัติแล้ว — ยุบมาจาก VerifiedReviewsSection (CAT-04) ที่ /shop
   * ให้แสดงในคารูเซลเดียวกับ curated · กรองเฉพาะ status='approved' + กันซ้ำชื่อ+ข้อความ
   */
  verifiedReviews?: VerifiedCustomerReview[]
  products: Product[]
  /** Preserves the existing review→cart deep-link flow (add item then navigate by mode). */
  onReviewCta?: (review: HomeReview) => void
}

// N4-R54 (Owner 2026-11-02 feedback): อัลบั้มไม่โชว์ inline — เปิดจากปุ่ม "ดูทั้งหมด" (modal + lightbox)
//   คงคลาส review-gallery* + behavior คลิกดูรูป/ปิด ไว้ทุกประการ

export function ReviewCarouselSection({ reviews, verifiedReviews, products, onReviewCta }: ReviewCarouselSectionProps) {
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

  // R89b (Owner ข้อ ก): รีวิว DB ที่แอดมินอนุมัติแล้ว → การ์ดใบเดียวกับ curated
  //   · เฉพาะ status='approved' (m199: pending/rejected ไม่ขึ้นหน้าแรก)
  //   · กันการ์ดซ้ำ: ชื่อ+ข้อความตรงกับ curated หรือรีวิวก่อนหน้า = ข้าม
  //   · rating ปัดเป็นจำนวนเต็ม (การ์ดโชว์ดาวทั้งใบ + "<rating>.0")
  const seenKeys = new Set(reviews.map((r) => `${r.displayName.trim()}|${r.text.trim()}`))
  const verifiedItems = (verifiedReviews ?? [])
    // ROOT CAUSE FIX (2026-11-09 — พิสูจน์จาก m199 line 76-85): RPC get_verified_reviews_batch
    //   RETURNS TABLE "ไม่มีคอลัมน์ status" → แถวคืนมา = undefined → เดิมเช็ก === 'approved'
    //   กรองทิ้งหมด 100% = การ์ด verified ไม่ขึ้น (ทั้งที่ RPC กรอง WHERE status='approved'
    //   อยู่แล้วตั้งแต่ต้น) → ให้ผ่านเมื่อ field ไม่ถูกคืน (undefined) · ถ้าคืนมาก็เช็กตามเดิม
    .filter((r) => (r.status === undefined || r.status === 'approved') && r.rating > 0 && Boolean(r.comment))
    .filter((r) => {
      const key = `${(r.customer_name || '').trim()}|${(r.comment || '').trim()}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, VERIFIED_FEED_MAX)
    .map((r) => {
      const product = productMap.get(r.product_id)
      const mode: OrderMode = (product?.available_preorder ?? product?.is_preorder) ? 'pre-order' : 'same-day'
      return (
        <CustomerReviewCard
          key={`verified-${r.id}`}
          review={{
            id: `verified-${r.id}`,
            customerName: r.customer_name,
            rating: Math.min(5, Math.round(r.rating)),
            comment: r.comment,
            source: 'website',
            sourceLabel: 'Verified Purchase',
            dateLabel: new Date(r.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
            foodName: r.product_name_display ?? product?.name ?? '',
            productId: r.product_id,
          }}
          product={product}
          mode={mode}
          deepLinkTo={mode === 'pre-order' ? '/checkout?mode=pre-order' : '/cart?mode=same-day'}
          onCta={() =>
            // R89c (Owner "จิ้มสั่งเมนูนั้นได้"): ยิงเส้น handleReviewCta เดียวกับ curated
            // (deriveOrderMode + schedule check + addItem + navigate — ไม่ใช่แค่ลิงก์เปล่า)
            onReviewCta?.({
              id: `verified-${r.id}`,
              displayName: r.customer_name,
              rating: Math.min(5, Math.round(r.rating)),
              text: r.comment,
              source: 'website',
              sourceLabel: 'Verified Purchase',
              dateLabel: '',
              relatedProduct: product,
              relatedProductName: r.product_name_display ?? product?.name ?? '',
              visible: true,
            })
          }
        />
      )
    })

  const allItems = [...verifiedItems, ...items] // R89c: รีวิวอนุมัติใหม่ขึ้นก่อนสุด (มติ Owner)

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
      {allItems.length > 0 && (
        <HorizontalCarousel
          items={allItems}
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