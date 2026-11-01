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
import { ScheduleDateBadge } from '@/components/home/ScheduleDateBadge'

// R44 (Owner 2026-11-01): เมนูที่เอามาแสดงต้อง "ลิงก์จริง" ไปหน้าเมนู +
// ปุ่มตามโหมดขายจริง — พรีออเดอร์ = "จองล่วงหน้า" · เซมเดย์ = "เพิ่มลงตะกร้า"
const isPreOrderOnly = (p: Product) => !!(p.available_preorder && !p.available_same_day)

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
  const preorderOnly = isPreOrderOnly(product)
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
        {/* R48: ปฏิทินมุมบนขวา — วันที่มาจากตารางเมนูจริง (schedule[p.id]) แสดงวันถูกต้องเสมอ */}
        {scheduledDate && (
          <div className="absolute top-1 right-1 z-10" data-testid="theater-rec-cal">
            <ScheduleDateBadge date={scheduledDate} />
          </div>
        )}
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
          disabled={denied}
          onClick={() => onAdd(product)}
          className="btn btn-primary btn-sm w-full disabled:opacity-50"
          data-testid="theater-rec-add"
        >
          {denied ? 'หมดแล้ว' : preorderOnly ? '📅 จองล่วงหน้า' : '🛒 เพิ่ม'}
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
  const preorderOnly = !!(product.available_preorder && !product.available_same_day)

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
        {/* R48: ปฏิทินมุมบนขวาของ hero — วันที่จริงจากตารางเมนู (ไม่เดา · ไม่มีแถว = ไม่แสดง) */}
        {scheduledDate && (
          <div className="absolute top-2 right-2 z-20" data-testid="theater-hero-cal">
            <ScheduleDateBadge date={scheduledDate} />
          </div>
        )}
        <div className="theater-hero-shade" aria-hidden="true" />
        <div className="theater-hero-badges">
          <ReasonChip reason={reason} />
          {!product.is_available || !!product.archived ? (
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-200">
              หมดแล้ว
            </span>
          ) : null}
          {preorderOnly && (
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
            disabled={denied}
            onClick={() => onAdd(product, qty)}
            className="btn btn-primary disabled:opacity-50"
            data-testid="theater-hero-add"
          >
            {/* R44: ปุ่มตามโหมด — พรีออเดอร์ = "จองล่วงหน้า" · เซมเดย์ = "เพิ่มลงตะกร้า" */}
            {denied
              ? 'หมดแล้ว'
              : preorderOnly
                ? `📅 จองล่วงหน้า${qty > 1 ? ` ${qty}` : ''}`
                : `🛒 เพิ่ม ${qty > 1 ? `${qty} ` : ''}ลงตะกร้า`}
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

