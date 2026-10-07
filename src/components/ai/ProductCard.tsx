// ============================================
// Bite Me Baby — Talk to Bite: ProductCard
// ============================================
// A compact menu card rendered inside a conversation. Data comes from the REAL
// catalog row; availability reflects current DB state. The add button funnels
// through the canonical cart path (addToCart on the parent → cartStore).
// ============================================

import type { Product } from '@/types'

interface ProductCardProps {
  product: Product
  onAdd: (product: Product) => void
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const denied = !product.is_available || !!product.archived
  return (
    <article
      data-testid="ttb-product-card"
      className="card bg-brand-surface overflow-hidden p-0 w-full"
    >
      <div className="flex items-stretch gap-3">
        <div className="w-20 h-20 shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span role="img" aria-label={product.name} className="w-full h-full block img-fallback" />
          )}
        </div>
        <div className="flex-1 min-w-0 py-2 pr-2 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-bold text-brand-accent truncate">{product.name}</h4>
              <span className="font-bold text-brand-primary whitespace-nowrap">฿{Number(product.price) || 0}</span>
            </div>
            {product.description && (
              <p className="text-xs text-brand-muted truncate" title={product.description}>
                {product.description}
              </p>
            )}
            {!product.available_same_day && !!product.available_preorder && (
              <p className="text-[10px] text-brand-primary mt-0.5">📅 สั่งล่วงหน้าเท่านั้น</p>
            )}
          </div>
          <button
            type="button"
            disabled={denied}
            onClick={() => onAdd(product)}
            className="btn btn-primary btn-sm w-full mt-1"
          >
            {denied ? 'หมดแล้ว' : '🛒 เพิ่มลงตะกร้า'}
          </button>
        </div>
      </div>
    </article>
  )
}