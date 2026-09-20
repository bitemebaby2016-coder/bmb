// ============================================
// Bite Me Baby — HomeProductCard (UI v5)
// Compact 2.5D horizontal card for Same-day / Pre-order carousels.
// Reuses the existing order hooks (onSameDay/onPreOrder) — business flow unchanged.
// ============================================

import type { HomeProduct, SameDayOrderPayload, PreOrderPayload } from '@/types'

interface HomeProductCardProps {
  item: HomeProduct
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
}

export function HomeProductCard({ item, onSameDay, onPreOrder }: HomeProductCardProps) {
  const soldOut = item.availability === 'sold_out'
  const lowStock = typeof item.stock === 'number' && item.stock > 0 && item.stock <= 5

  const handleCta = () => {
    if (soldOut) return
    if (item.mode === 'pre-order') {
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
    <article className={`home-card${item.mode === 'pre-order' ? ' home-card--preorder' : ''}`}>
      <div className="home-card-media">
        {item.image ? (
          <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
        ) : (
          <img
            src="/images/mock/food-mock.svg"
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="home-card-fallback-img"
          />
        )}
        {item.badge && <span className="home-card-badge">{item.badge}</span>}
        {lowStock && <span className="home-card-stock">🔥 เหลือ {item.stock} กล่อง</span>}
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
          className="btn btn-primary btn-sm w-full mt-2 home-card-cta"
          disabled={soldOut}
        >
          {soldOut ? 'หมดแล้ว' : item.cta}
        </button>
      </div>
    </article>
  )
}