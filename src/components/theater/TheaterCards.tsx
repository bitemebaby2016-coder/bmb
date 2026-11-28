// ============================================
// Bite Me Baby — Food Theater cards (LEVEL 2 + LEVEL 3)
// ============================================
// Visual presentation layer ONLY — data comes from the REAL catalog row and
// every add action funnels through the canonical cart path (parent →
// cartStore.addItem). Theme-driven stage surfaces (light/dark) with brand orange accent lighting;
// orange stays the action color (existing design language preserved).
//   LEVEL 2 = RecommendationCard (Bite recommendations in conversation/stage)
//   LEVEL 3 = TheaterHeroCard     (the signature 2.5D hero on /shop)
// LEVEL 1 (mini) = existing components/ai/ProductCard — unchanged.
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '@/types'
import type { TheaterReason } from '@/lib/theaterReasons'
import { deriveOrderMode } from '@/lib/talkToBite'
import { ScheduleDateBadge } from '@/components/home/ScheduleDateBadge'

// R44 (Owner 2026-11-01): เมนูที่เอามาแสดงต้อง "ลิงก์จริง" ไปหน้าเมนู +
// ปุ่มตามโหมดขายจริง — พรีออเดอร์ = "จองล่วงหน้า" · เซมเดย์ = "เพิ่มลงตะกร้า"
// R131 (Owner 2026-11-28): พรีออเดอร์ที่ยังไม่ลงปฏิทิน = ปุ่มเทา (btn-locked) "ยังไม่ลงปฏิทินรอบถัดไป"
//   ตรงรูปแบบกับ HomeProductCard (preOrderReady/disabledCta) — ไม่ใช่ปุ่มสดที่กดแล้ว toast

// R128 (Owner 2026-11-27): มุมรูปขวาบนของการ์ดเธียเตอร์ — รูปแบบเดียวกันทุกการ์ด/ทุกโหมด:
//   มีวันจัดส่งจริง → ปฏิทินลอยมาตรฐาน (ScheduleDateBadge เดียวกับหน้า /menu)
//   พรีออเดอร์แต่ยังไม่ลงปฏิทิน → ป้าย "📅 ยังไม่ลงปฏิทิน" มุมเดิม
//   เซมเดย์ → ป้าย "⚡ ส่งวันนี้" มุมเดิม
export function ModeCornerBadge({ mode, scheduledDate, className, testId }: {
  mode: 'SAME_DAY' | 'PRE_ORDER' | null
  scheduledDate?: string
  className: string
  testId: string
}) {
  if (scheduledDate) {
    return (
      <div className={className} data-testid={`${testId}-cal`}>
        <ScheduleDateBadge date={scheduledDate} />
      </div>
    )
  }
  if (mode === 'PRE_ORDER') {
    return (
      <div className={className} data-testid={`${testId}-unscheduled`}>
        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-stone-500/30 border border-stone-400/50 text-stone-100">
          📅 ยังไม่ลงปฏิทิน
        </span>
      </div>
    )
  }
  if (mode === 'SAME_DAY') {
    return (
      <div className={className} data-testid={`${testId}-sameday`}>
        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-100">
          ⚡ ส่งวันนี้
        </span>
      </div>
    )
  }
  return null
}

function ReasonChip({ reason }: { reason?: TheaterReason | null }) {
  if (!reason) return null
  return (
    <span className="theater-reason" data-testid="theater-reason">
      <span aria-hidden="true">{reason.icon}</span> {reason.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// LEVEL 2 — RecommendationCard
// ---------------------------------------------------------------------------
interface RecommendationCardProps {
  product: Product
  reason?: TheaterReason | null
  /** R48 (Owner): ป้ายปฏิทินมุมบนขวา = วันจัดส่งจริงจาก menu_schedule (แบบฟอร์มเดียวกับการ์ดเมนูหน้า /menu) */
  scheduledDate?: string
  /** Quick add → canonical cart (mode derived from real canonical columns). */
  onAdd: (product: Product) => void
}

export function RecommendationCard({ product, reason, scheduledDate, onAdd }: RecommendationCardProps) {
  const denied = !product.is_available || !!product.archived
  const mode = deriveOrderMode(product)
  // R131: ตรงรูปแบบ HomeProductCard — พรีออเดอร์ต้องมีวันปฏิทินจริงจึงกดได้
  const preOrderCta = mode === 'PRE_ORDER'
  const preOrderReady = preOrderCta && !!scheduledDate
  const disabledCta = denied || (preOrderCta && !preOrderReady)
  const ctaLabel = denied
    ? 'หมดแล้ว'
    : preOrderCta
      ? (preOrderReady ? '📅 จองล่วงหน้า' : '📅 ยังไม่ลงปฏิทินรอบถัดไป')
      : '🛒 เพิ่มลงตะกร้า'
  return (
    <article data-testid="theater-rec-card" className="theater-rec-card">
      <div className="theater-rec-media" style={{ position: 'relative' }}>
        {/* R44: รูปเมนู = ลิงก์จริงไปหน้าเมนู (ไม่ใช่รูปตาย) */}
        <Link to="/menu" aria-label={`ดู ${product.name} ในหน้าเมนูจริง`} data-testid="theater-rec-link">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" />
          ) : (
            <span role="img" aria-label={product.name} className="theater-img-fallback" />
          )}
        </Link>
        {/* R48/R128: มุมบนขวา — ปฏิทินวันจัดส่งจริง / ยังไม่ลงปฏิทิน / ส่งวันนี้ */}
        <ModeCornerBadge mode={mode} scheduledDate={scheduledDate} className="absolute top-1 right-1 z-10" testId="theater-rec" />
        <div className="theater-rec-media-glow" aria-hidden="true" />
      </div>
      <div className="theater-rec-body">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display font-bold text-[var(--theater-fg)] text-sm leading-snug line-clamp-2">
            <Link to="/menu" className="text-inherit hover:underline" data-testid="theater-rec-title-link">{product.name}</Link>
          </h4>
          <span className="theater-price-sm">฿{Number(product.price) || 0}</span>
        </div>
        <ReasonChip reason={reason} />
        <button
          type="button"
          disabled={disabledCta}
          onClick={() => onAdd(product)}
          className={`btn btn-sm w-full ${disabledCta ? 'btn-locked' : 'btn-primary'}`}
          data-testid="theater-rec-add"
        >
          {ctaLabel}
        </button>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// LEVEL 3 — TheaterHeroCard (large 2.5D hero — the visual signature)
// ---------------------------------------------------------------------------
interface TheaterHeroCardProps {
  product: Product
  reason?: TheaterReason | null
  /** R48: ป้ายปฏิทินมุมบนขวา — วันจัดส่งจริงจาก menu_schedule (แบบฟอร์มเดียวกับ /menu) */
  scheduledDate?: string
  /** Quick add with the selected quantity → canonical cart. */
  onAdd: (product: Product, quantity: number) => void
  /** Open the existing detail/customization surface (OrderBuilder). */
  onCustomize: (product: Product) => void
}

export function TheaterHeroCard({ product, reason, scheduledDate, onAdd, onCustomize }: TheaterHeroCardProps) {
  const [qty, setQty] = useState(1)
  const denied = !product.is_available || !!product.archived
  const mode = deriveOrderMode(product)
  // R131: ตรงรูปแบบ HomeProductCard — พรีออเดอร์ต้องมีวันปฏิทินจริงจึงกดได้ (ถ้าไม่มี = ปุ่มเทา)
  const preOrderCta = mode === 'PRE_ORDER'
  const preOrderReady = preOrderCta && !!scheduledDate
  const disabledCta = denied || (preOrderCta && !preOrderReady)
  const ctaLabel = denied
    ? 'หมดแล้ว'
    : preOrderCta
      ? (preOrderReady ? `📅 จองล่วงหน้า${qty > 1 ? ` ${qty}` : ''}` : '📅 ยังไม่ลงปฏิทินรอบถัดไป')
      : `🛒 เพิ่ม ${qty > 1 ? `${qty} ` : ''}ลงตะกร้า`

  return (
    <article className="theater-hero" data-testid="theater-hero">
      <div className="theater-hero-media">
        {/* R44: รูปเมนู = ลิงก์จริงไปหน้าเมนู */}
        <Link to="/menu" aria-label={`ดู ${product.name} ในหน้าเมนูจริง`} data-testid="theater-hero-link">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading="eager" decoding="async" />
          ) : (
            <span role="img" aria-label={product.name} className="theater-img-fallback theater-img-fallback--lg" />
          )}
        </Link>
        {/* R48/R128: มุมขวาของ hero — ปฏิทินวันจัดส่งจริง / ยังไม่ลงปฏิทิน / ส่งวันนี้ */}
        <ModeCornerBadge mode={mode} scheduledDate={scheduledDate} className="absolute top-2 right-2 z-20" testId="theater-hero" />
        <div className="theater-hero-shade" aria-hidden="true" />
        <div className="theater-hero-badges">
          <ReasonChip reason={reason} />
          {!product.is_available || !!product.archived ? (
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-200">
              หมดแล้ว
            </span>
          ) : null}
          {preOrderCta && (
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-500/25 border border-amber-400/50 text-amber-100">
              📅 สั่งล่วงหน้า
            </span>
          )}
        </div>
      </div>

      <div className="theater-hero-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-[var(--theater-fg)] text-lg leading-tight line-clamp-2">
              <Link to="/menu" className="text-inherit hover:underline" data-testid="theater-hero-title-link">{product.name}</Link>
            </h3>
            {product.description && (
              <p className="text-xs text-[var(--theater-fg-muted)] mt-1 line-clamp-2">{product.description}</p>
            )}
          </div>
          <span className="theater-price">฿{Number(product.price) || 0}</span>
        </div>

        <div className="theater-cta-row">
          <div className="theater-qty" role="group" aria-label="จำนวน">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={denied || qty <= 1}
              aria-label="ลดจำนวน"
              data-testid="theater-qty-minus"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="min-w-5 text-center text-sm font-bold text-[var(--theater-fg)]"
              data-testid="theater-qty-value"
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              disabled={denied || qty >= 20}
              aria-label="เพิ่มจำนวน"
              data-testid="theater-qty-plus"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={disabledCta}
            onClick={() => onAdd(product, qty)}
            className={`btn ${disabledCta ? 'btn-locked' : 'btn-primary'}`}
            data-testid="theater-hero-add"
          >
            {/* R44/R131: ปุ่มตามโหมด — พรีออเดอร์ไม่ลงปฏิทิน = ปุ่มเทา · เซมเดย์ = เพิ่มลงตะกร้า */}
            {ctaLabel}
          </button>
          <button
            type="button"
            disabled={denied}
            onClick={() => onCustomize(product)}
            className="btn btn-theater-outline disabled:opacity-50"
            data-testid="theater-hero-customize"
          >
            🛠 ปรับแต่ง
          </button>
        </div>
      </div>
    </article>
  )
}

