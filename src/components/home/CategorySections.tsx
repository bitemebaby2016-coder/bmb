// ============================================
// Bite Me Baby — CategorySections (Home) — DB-driven canonical carousels
// AI-UI: renders ONE carousel per active product_category (real DB sync):
//   หัวข้อ = category.name + icon (แอดมินแก้ที่ /admin/products → sync ทันที)
//   เรียงตาม sort_order, ซ่อนเองถ้าหมวดไม่มีสินค้าพร้อมขาย
// มาสคอตประจำเซกชันสลับทุกตัวใน MASCOT_POSES (หน้า/เซกชันซ้ำ = ตัวถัดไป)
// ============================================

import { Link } from 'react-router-dom'
import { MascotBadge } from '@/components/MascotBadge'
import { HorizontalCarousel } from './HorizontalCarousel'
import { selectHomeShowcase, type HomeShowcaseItem } from '@/lib/homeShowcase'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload } from '@/types'

const SECTION_POSES = ['peeking', 'thumbsup', 'running', 'pointing', 'cooking', 'menu', 'greeting', 'heart'] as const

function ShowcaseCard({
  item,
  onSameDay,
  onPreOrder,
}: {
  item: HomeShowcaseItem
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
}) {
  // FIX (owner report 2026-10-01): showcase cards in admin-added sections had
  // NO add-to-cart button at all — mirror HomeProductCard's CTA behavior here:
  // sold-out → disabled label; same-day → add-to-cart; preorder-only → pre-order.
  const handleSameDay = () => {
    if (!item.isAvailable || !item.sameDay) return
    onSameDay({
      productId: item.id,
      quantity: 1,
      timestamp: new Date().toISOString(),
      availabilitySnapshot: {
        isAvailable: item.isAvailable,
        engineState: item.isAvailable ? 'available' : 'sold_out',
        source: 'home_showcase',
        snapshotAt: new Date().toISOString(),
      },
    })
  }
  const handlePreOrder = () => {
    if (!item.preorder) return
    onPreOrder({ productId: item.id, quantity: 1, deliveryRoundId: '', scheduledDate: '' })
  }
  const soldOut = !item.isAvailable

  return (
    <article
      className="drink-card"
      aria-label={item.name}
      data-coming-soon="false"
    >
      <div className="drink-card-media">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      </div>
      <div className="drink-card-body">
        <div className="drink-card-name">
          <h3 className="font-bold text-brand-accent truncate">{item.name}</h3>
          <span className="drink-card-price">฿{item.price}</span>
        </div>
        <p className="drink-card-desc">{item.description}</p>
        <div className="flex flex-col gap-2 mt-2">
          {item.sameDay && !soldOut && (
            <button
              type="button"
              onClick={handleSameDay}
              data-testid="home-showcase-add-to-cart"
              className="btn btn-primary btn-sm w-full"
              aria-label={`เพิ่ม ${item.name} ลงตะกร้า`}
            >
              🛒 เพิ่มลงตะกร้า
            </button>
          )}
          {item.preorder && (
            <button
              type="button"
              onClick={handlePreOrder}
              data-testid="home-showcase-preorder"
              className={`btn btn-sm w-full ${soldOut ? 'btn-outline' : 'btn-outline'}`}
              aria-label={`จอง ${item.name} ล่วงหน้า`}
            >
              📅 จองล่วงหน้า
            </button>
          )}
          {soldOut && (
            <span className="text-xs text-red-600 text-center font-medium">หมดแล้ววันนี้</span>
          )}
        </div>
      </div>
    </article>
  )
}

export function CategorySections({
  products,
  categories,
  onSameDay,
  onPreOrder,
}: {
  products: Product[]
  categories: ProductCategory[]
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
}) {
  const active = [...categories]
    .filter((c) => c.is_active && !c.archived)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <>
      {active.map((cat, idx) => {
        const items = selectHomeShowcase(products, categories, cat.slug)
        if (items.length === 0) return null
        const headingId = `home-cat-${cat.slug}`
        const pose = SECTION_POSES[idx % SECTION_POSES.length]
        return (
          <section key={cat.id} className="mb-10 scroll-mt-20" aria-labelledby={headingId}>
            <div className="flex items-center justify-between mb-2">
              <h2 id={headingId} className="text-xl font-display font-bold text-brand-accent flex items-center gap-2">
                <MascotBadge
                  pose={pose}
                  size="sm"
                  alt={`น้อง Bite ประจำหมวด ${cat.name}`}
                  className="section-float-mascot"
                />
                <span>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
              </h2>
              <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
            </div>
            <h3 className="sr-only">{cat.name}</h3>
            <HorizontalCarousel
              items={items.map((item) => (
                <ShowcaseCard key={item.id} item={item} onSameDay={onSameDay} onPreOrder={onPreOrder} />
              ))}
              aria-label={`${cat.name} เลื่อนได้`}
            />
          </section>
        )
      })}
    </>
  )
}