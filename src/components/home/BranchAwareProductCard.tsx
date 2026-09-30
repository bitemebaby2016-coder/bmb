// ============================================
// Bite Me Baby — Branch-Aware Product Card (CAT-04)
// Shows multi-branch specific badges:
//   - "หมดชั่วคราวประจำสาขา" when OOS at current branch but available globally
//   - "Pre-Order Only" for pre-order mode products
//   - Branch-specific availability state
// Internal linking: CTA → /cart or /checkout; product → /reviews/:productId
// ============================================

import { Link } from 'react-router-dom'
import type { HomeProduct, SameDayOrderPayload, PreOrderPayload } from '@/types'

interface BranchAwareProductCardProps {
  item: HomeProduct
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
  /** Optional branch context for showing branch-specific info */
  branchId?: string | null
  /** Override badge text from branch override data */
  branchBadge?: 'out_of_stock_branch' | 'available_at_branch' | null
}

export function BranchAwareProductCard({ item, onSameDay, onPreOrder, branchId, branchBadge }: BranchAwareProductCardProps) {
  const soldOut = item.availability === 'sold_out'
  const lowStock = typeof item.stock === 'number' && item.stock > 0 && item.stock <= 5
  
  // Branch-specific OOS: product is globally available but hidden/OOS at this branch
  const branchOos = branchBadge === 'out_of_stock_branch'
  
  // Build CTA text based on state
  let ctaText: string
  let ctaDisabled = soldOut || branchOos
  if (soldOut || branchOos) {
    ctaText = branchOos ? 'หมดชั่วคราว · สาขาที่เลือก' : 'หมดแล้ว'
  } else if (item.mode === 'pre-order') {
    ctaText = 'จองล่วงหน้า'
  } else {
    ctaText = 'เพิ่มลงตะกร้า'
  }

  const handleCta = () => {
    if (ctaDisabled) return
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
        
        {/* Badge row */}
        <div className="home-card-badges">
          {item.badge && !branchOos && <span className="home-card-badge">{item.badge}</span>}
          {branchOos && <span className="home-card-badge home-card-badge-oos-branch">หมดชั่วคราว</span>}
          {item.mode === 'pre-order' && !branchOos && (
            <span className="home-card-badge home-card-badge-preorder">Pre-Order</span>
          )}
          {lowStock && !branchOos && <span className="home-card-stock">เหลือ {item.stock} กล่อง</span>}
          {item.mode === 'pre-order' && item.scheduledDate && !branchOos && (
            <span className="home-card-scheduled">พร้อมส่ง {formatThaiDate(item.scheduledDate)}</span>
          )}
        </div>
      </div>

      <div className="home-card-body">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-brand-accent truncate">
            <Link to={`/reviews/${item.id}`} className="hover:underline hover:text-brand-primary transition-colors">
              {item.name}
            </Link>
          </h3>
          <span className="font-bold text-brand-primary text-lg whitespace-nowrap">฿{item.price}</span>
        </div>
        {item.description && (
          <p className="text-sm text-brand-muted truncate" title={item.description}>{item.description}</p>
        )}
        {typeof item.rating === 'number' && (
          <div className="text-xs text-amber-500" aria-label={`คะแนน ${item.rating} จาก 5`}>
            ⭐ {item.rating} <span className="text-brand-muted">({item.reviewCount ?? 0})</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleCta}
          className="btn btn-primary btn-sm w-full mt-2 home-card-cta"
          disabled={ctaDisabled}
        >
          {ctaText}
        </button>
        {/* Internal link to verified reviews for this product */}
        <Link
          to={`/reviews/${item.id}`}
          className="text-xs text-brand-muted hover:text-brand-primary mt-1 block text-center"
        >
          ดูรีวิว ({item.reviewCount ?? 0})
        </Link>
      </div>
    </article>
  )
}

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}
