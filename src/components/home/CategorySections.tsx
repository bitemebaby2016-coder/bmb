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
import type { Product, ProductCategory, MenuSection, SameDayOrderPayload, PreOrderPayload } from '@/types'

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
  sections = [],
  onSameDay,
  onPreOrder,
}: {
  products: Product[]
  categories: ProductCategory[]
  /** B-fix (owner 2026-10-01): กลุ่มใหญ่ menu_sections — ถ้ามี จะแสดงหัวข้อกลุ่มครอบ carousel หมวด (ให้ผลทุกหน้าเหมือน MenuPage) */
  sections?: MenuSection[]
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
}) {
  const active = [...categories]
    .filter((c) => c.is_active && !c.archived)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const activeSections = [...sections]
    .filter((s) => s.is_active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  // หมวดที่อยู่ใน Section ที่กำลังแสดงอยู่ (หมวดใน Section ที่ปิดจะถูกซ่อนตาม server gate CAT-D01=B)
  const shownSectionCatIds = new Set(
    activeSections.flatMap((s) => active.filter((c) => c.menu_section_id === s.id).map((c) => c.id)),
  )
  const loose = active.filter((c) => !shownSectionCatIds.has(c.id))

  let carouselIdx = 0
  const renderCategoryCarousel = (cat: ProductCategory, grouped: boolean) => {
    const items = selectHomeShowcase(products, categories, cat.slug)
    const idx = carouselIdx++
    const headingId = `home-cat-${cat.slug}`
    const pose = SECTION_POSES[idx % SECTION_POSES.length]
    // FIX (owner 2026-10-06): หมวดที่แอดมินเพิ่มต้องโชว์บนหน้าแรกเสมอ (ต่อจาก
    // หมวดเดิม ก่อนเซกชันรีวิว) — ถ้ายังไม่มีสินค้าพร้อมขายแสดง empty state
    // "เร็ว ๆ นี้" แทนการซ่อนทั้งเซกชัน
    if (items.length === 0) {
      return (
        <section key={cat.id} className={`${grouped ? 'mb-8' : 'mb-10'} scroll-mt-20`} aria-labelledby={headingId} data-testid={`home-cat-empty-${cat.slug}`}>
          <div className="flex items-center justify-between mb-2">
            <h3
              id={headingId}
              className={`${grouped ? 'text-lg' : 'text-xl'} font-display font-bold text-brand-accent flex items-center gap-2`}
            >
              <MascotBadge
                pose={pose}
                size="sm"
                alt={`น้อง Bite ประจำหมวด ${cat.name}`}
                className="section-float-mascot"
              />
              <span>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
            </h3>
            <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
          </div>
          <div className="drink-card flex items-center justify-center text-center" data-testid="home-showcase-empty">
            <p className="drink-card-desc py-6">
              ยังไม่มีเมนูในหมวดนี้ — เร็ว ๆ นี้ 🍽️
            </p>
          </div>
        </section>
      )
    }
    return (
      <section key={cat.id} className={`${grouped ? 'mb-8' : 'mb-10'} scroll-mt-20`} aria-labelledby={headingId}>
        <div className="flex items-center justify-between mb-2">
          <h3
            id={headingId}
            className={`${grouped ? 'text-lg' : 'text-xl'} font-display font-bold text-brand-accent flex items-center gap-2`}
          >
            <MascotBadge
              pose={pose}
              size="sm"
              alt={`น้อง Bite ประจำหมวด ${cat.name}`}
              className="section-float-mascot"
            />
            <span>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
          </h3>
          <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
        </div>
        <h4 className="sr-only">{cat.name}</h4>
        <HorizontalCarousel
          items={items.map((item) => (
            <ShowcaseCard key={item.id} item={item} onSameDay={onSameDay} onPreOrder={onPreOrder} />
          ))}
          aria-label={`${cat.name} เลื่อนได้`}
        />
      </section>
    )
  }

  // ไม่มี Section → แสดงแบบเดิม (1 carousel ต่อ 1 หมวด)
  if (activeSections.length === 0) {
    return <>{active.map((cat) => renderCategoryCarousel(cat, false))}</>
  }

  // มี Section → หัวข้อกลุ่มใหญ่ครอบหมวด (เดียวกับ MenuPage: Menu → Section → Category)
  return (
    <>
      {activeSections.map((s) => (
        <div key={s.id} className="mb-12">
          <h2 className="text-2xl font-display font-bold text-brand-primary border-b-2 border-brand-primary/20 pb-2 mb-5">
            {s.name}
          </h2>
          {active
            .filter((c) => c.menu_section_id === s.id)
            .map((cat) => renderCategoryCarousel(cat, true))}
        </div>
      ))}
      {loose.map((cat) => renderCategoryCarousel(cat, true))}
    </>
  )
}