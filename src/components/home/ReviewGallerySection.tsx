// ============================================
// Bite Me Baby — ReviewGallerySection (Home)
// รีวิวจริงจากลูกค้า: รูปสกรีนช็อตรีวิวจริง แสดงแบบ lazy grid
// รูปถูกย่อไว้ที่ /assets/reviews/small/ — โหลดเมื่อ scroll ถึงเท่านั้น
// ============================================

import { useState } from 'react'
import { REAL_REVIEW_PHOTOS } from '@/lib/realReviews'

// PERF: render 12 thumbs in the DOM first — the rest are one click away.
// Cuts ~25 nodes x nested elements from initial Style&Layout work.
const INITIAL_COUNT = 12

export function ReviewGallerySection() {
  const [open, setOpen] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  if (REAL_REVIEW_PHOTOS.length === 0) return null

  const visible = showAll ? REAL_REVIEW_PHOTOS : REAL_REVIEW_PHOTOS.slice(0, INITIAL_COUNT)

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="home-review-gallery-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-review-gallery-heading" className="text-xl font-display font-bold text-brand-accent">
          📸 รีวิวจริงจากลูกค้า
        </h2>
        <span className="text-sm text-brand-muted">{REAL_REVIEW_PHOTOS.length} รีวิว</span>
      </div>
      <div className="review-gallery" role="list">
        {visible.map((p) => (
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
    </section>
  )
}
