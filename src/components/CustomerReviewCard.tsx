// ============================================
// Bite Me Baby — CustomerReviewCard v1.0
// Layout: 2.5D/3D Hybrid Glassmorphism (Social Proof Review Feed)
// - Background: ภาพอาหาร WebP ความละเอียดสูง (Lazy Loading)
// - Glassmorphism Overlay: backdrop-filter: blur() แสดงรีวิวจริง (Facebook / GrabFood)
// - 3D Star Rating + CSS Micro-animation (Glow / Pulse)
// - Mascot "น้อง Bite" จิ๋ว มุมล่างการ์ด
// - CTA Deep Link ตรงเข้า Cart / Checkout ตาม Mode (same-day / pre-order)
// @see docs/COMPONENT_SPEC_UI.md §12 CustomerReviewCard + Glassmorphism Spec
// ============================================

import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { SocialProofReview, Product, OrderMode } from '@/types'
import { MascotBadge } from '@/components/MascotBadge'

interface CustomerReviewCardProps {
  review: SocialProofReview
  /** สินค้าจริงที่มาจาก data layer (ใช้ id → image_url สำหรับพื้นหลัง WebP) */
  product?: Product
  mode: OrderMode
  /** Deep Link target — คำนวณใน parent ตาม Mode */
  deepLinkTo: string
  ctaLabel?: string
  /** ทางเลือก: parent เตรียมของ (addItem ฯลฯ) ก่อน navigate ตาม deepLinkTo */
  onCta?: () => void
}

const SOURCE_LOGO: Partial<Record<SocialProofReview['source'], string>> = {
  facebook: '/Facebook Logo.webp',
  grabfood: '/Grab Food Logo.webp',
}

const SOURCE_COLOR: Record<SocialProofReview['source'], string> = {
  facebook: '#1877F2',
  grabfood: '#00B14F',
  website: '#EA580C',
}

const FALLBACK_EMOJI = '🍜'

export function CustomerReviewCard({ review, product, mode, deepLinkTo, ctaLabel, onCta }: CustomerReviewCardProps) {
  const imageUrl = product?.image_url ?? ''
  const isAvailable = Boolean(product?.is_available)
  const label = ctaLabel ?? (mode === 'pre-order' ? '📅 จองเมนูนี้' : '🛒 สั่งเมนูนี้')

  return (
    <article className="review-card-3d group">
      {/* Background: ภาพอาหาร WebP ความละเอียดสูง (Lazy Loading) */}
      <div className="review-card-bg" aria-hidden="true">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${review.foodName} — ภาพอ้างอิงรีวิวจาก ${review.sourceLabel}`}
            loading="lazy"
            decoding="async"
            className="review-card-img"
          />
        ) : (
          <div className="review-card-bg-fallback" role="img" aria-label={`ภาพอาหาร ${review.foodName}`}>
            {FALLBACK_EMOJI}
          </div>
        )}
      </div>

      {/* Glassmorphism Overlay — รีวิวจริงจาก Facebook / GrabFood */}
      <div className="review-card-glass">
        <div className="flex items-center justify-between gap-2">
          <span className="review-source-badge">
            {SOURCE_LOGO[review.source] && (
              <img
                src={SOURCE_LOGO[review.source]}
                alt=""
                loading="lazy"
                decoding="async"
                className="review-source-logo"
              />
            )}
            <span style={{ color: SOURCE_COLOR[review.source] }}>{review.sourceLabel}</span>
          </span>
          <span className="review-date">{review.dateLabel}</span>
        </div>

        {/* 3D Star Rating — Star.webp (Glow / Pulse micro-animation) */}
        <div className="star-rating-3d" role="img" aria-label={`คะแนน ${review.rating} เต็ม 5`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <img
              key={i}
              src="/Star.webp"
              alt=""
              loading="lazy"
              decoding="async"
              className={`star-3d-img${i < review.rating ? '' : ' is-empty'}`}
              style={{ '--star-i': i } as CSSProperties}
              aria-hidden="true"
            />
          ))}
          <span className="star-num">{review.rating}.0</span>
        </div>

        <p className="review-comment">“{review.comment}”</p>

        <div className="review-customer">
          <div className="review-avatar" aria-hidden="true">
            {review.customerName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="review-name">{review.customerName}</div>
            <div className="review-food">{review.foodName}</div>
          </div>
          {!isAvailable && product && (
            <span className="review-soldout">หมดชั่วคราว</span>
          )}
        </div>

        {/* CTA — Deep Link ตรงเข้า Cart / Checkout ตาม Mode */}
        <Link
          to={deepLinkTo}
          onClick={() => onCta?.()}
          className="review-cta"
          aria-label={`${label} — ${review.foodName}`}
        >
          {label}
          <span aria-hidden="true" className="review-cta-arrow">→</span>
        </Link>
      </div>

      {/* 3D Mascot "น้อง Bite" จิ๋ว มุมล่างการ์ด (MascotBadge pose=heart — Mini Heart) */}
      <MascotBadge
        pose="heart"
        size="sm"
        alt="น้อง Bite มิ่งขวัญร้าน Bite Me Baby"
        className="mascot-mini"
      />
    </article>
  )
}