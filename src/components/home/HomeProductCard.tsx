// ============================================
// Bite Me Baby — HomeProductCard (UI v5)
// Compact 2.5D horizontal card for Same-day / Pre-order carousels.
// Reuses the existing order hooks (onSameDay/onPreOrder) — business flow unchanged.
// ============================================

import type { HomeProduct, SameDayOrderPayload, PreOrderPayload } from '@/types'
import { ScheduleDateBadge } from '@/components/home/ScheduleDateBadge'

type SectionMode = 'same_day' | 'pre_order' | 'auto'

interface HomeProductCardProps {
  item: HomeProduct
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
  /** Phase 5B (A1 · INV-16): mode ของ section ที่ครอบการ์ด — 'same_day'/'pre_order'
   *  บังคับ CTA ตาม section (ข้อมูล item ขัดกันก็ตาม) · 'auto' = พฤติกรรมเดิม (item.mode) */
  mode?: SectionMode
}

export function HomeProductCard({ item, onSameDay, onPreOrder, mode = 'auto' }: HomeProductCardProps) {
  const soldOut = item.availability === 'sold_out'
  const lowStock = typeof item.stock === 'number' && item.stock > 0 && item.stock <= 5
  // A1: effective mode — explicit section mode ชนะ item.mode → section ไม่มีวันมีปุ่มอีกโหมด
  const isPreOrderCta = mode === 'pre_order' ? true : mode === 'same_day' ? false : item.mode === 'pre-order'
  // R5c (Owner 2026-10-23): ปุ่มจองล่วงหน้ากดได้เฉพาะการ์ดที่มีป้ายปฏิทิน (เมนูปฏิทินแอดมิน)
  const preOrderReady = isPreOrderCta && !!item.scheduledDate
  const disabledCta = soldOut || (isPreOrderCta && !preOrderReady)
  const ctaLabel = soldOut
    ? 'หมดแล้ว'
    : isPreOrderCta
      ? (preOrderReady ? '📅 จองล่วงหน้า' : '📅 ยังไม่ลงปฏิทินรอบถัดไป')
      : '🛒 เพิ่มลงตะกร้า'

  const handleCta = () => {
    if (soldOut) return
    if (isPreOrderCta) {
      if (!preOrderReady) return
      onPreOrder({ productId: item.id, quantity: 1, deliveryRoundId: '', scheduledDate: item.scheduledDate || '' })
      return
    }
    onSameDay({
      productId: item.id,
      quantity: 1,
      timestamp: new Date().toISOString(),
      availabilitySnapshot: {
        isAvailable: item.availability === 'available',
        engineState: item.availability,
        source: 'home_provider',
        snapshotAt: new Date().toISOString(),
      },
    })
  }

  return (
    <article className={`home-card${isPreOrderCta ? ' home-card--preorder' : ''}`}>
      <div className="home-card-media">
        {item.image ? (
          <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
        ) : (
          <span
            role="img"
            aria-label={item.name}
            className="home-card-fallback-img img-fallback"
          />
        )}
        {item.badge && <span className="home-card-badge">{item.badge}</span>}
        {lowStock && <span className="home-card-stock">🔥 เหลือ {item.stock} กล่อง</span>}
        {isPreOrderCta && item.scheduledDate && (
          <ScheduleDateBadge date={item.scheduledDate} />
        )}
      </div>

      <div className="home-card-body">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-brand-accent truncate">{item.name}</h3>
          <span className="font-bold text-brand-primary text-lg whitespace-nowrap">฿{item.price}</span>
        </div>
        {item.description && (
          <p className="text-sm text-brand-muted truncate" title={item.description}>{item.description}</p>
        )}
        {typeof item.rating === 'number' && (
          <div className="text-xs text-amber-500" aria-label={`คะแนน ${item.rating} จาก 5`}>
            ⭐ {item.rating}
            <span className="text-brand-muted"> ({item.reviewCount ?? 0})</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleCta}
          // L-8 (N-4 #8): พรีออเดอร์ยังไม่ลงปฏิทิน/หมดแล้ว = btn-locked (สีเทา + กดไม่ได้)
          className={`btn btn-sm w-full mt-auto home-card-cta${disabledCta ? ' btn-locked' : ' btn-primary'}`}
          disabled={disabledCta}
          data-testid="home-card-cta"
        >
          {ctaLabel}
        </button>
      </div>
    </article>
  )
}