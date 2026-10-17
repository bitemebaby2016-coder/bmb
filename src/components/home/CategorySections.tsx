// ============================================
// Bite Me Baby — CategorySections (Home) — DB-driven canonical carousels
// ============================================
// ระบบ "หัวข้อเมนู" เดียว (2026-10-17):
// - หัวข้อ = หมวดหมู่ (ชั้นเดียว) → การ์ด — จัดกลุ่มด้วย buildHeadingGroups
//   ตัวเดียวกับ /menu → หน้าแรกและเมนูรวมแสดงตรงกัน ครบทุกเมนู ไม่มีตัวซ้อน
// - หัวข้อว่าง/ปิด/จัดเก็บ = ซ่อน (ไม่โชว์การ์ดเปล่า "เร็ว ๆ นี้")
// - การ์ดหนึ่งใบ = ปุ่มเดียวเสมอ (SectionMode ตามหัวข้อที่การ์ดอยู่)
// - วันจัดส่งบนป้ายปฏิทิน = menu_schedule (ProductScheduleMap) — ไม่ใช้ products.scheduled_date
// มาสคอตประจำเซกชันสลับทุกตัวใน MASCOT_POSES (หน้า/เซกชันซ้ำ = ตัวถัดไป)
// ============================================

import { Link } from 'react-router-dom'
import { MascotBadge } from '@/components/MascotBadge'
import { HorizontalCarousel } from './HorizontalCarousel'
import { ScheduleDateBadge } from './ScheduleDateBadge'
import { selectHomeShowcase, type HomeShowcaseItem } from '@/lib/homeShowcase'
import { buildHeadingGroups, saleModeOfCategory, type SaleMode } from '@/lib/catalogStructure'
import type { ProductScheduleMap } from '@/lib/productSchedule'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload } from '@/types'

const SECTION_POSES = ['peeking', 'thumbsup', 'running', 'pointing', 'cooking', 'menu', 'greeting', 'heart'] as const

function ShowcaseCard({
  item,
  cat,
  onSameDay,
  onPreOrder,
  mode = 'auto',
}: {
  item: HomeShowcaseItem
  cat: ProductCategory
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
  /** SectionMode ของช่อง/หมวดที่การ์ดอยู่ — 'same_day'/'pre_order' บังคับปุ่มเดียวตามช่อง ·
   *  'auto' = หมวดกลาง ๆ → ใช้โหมดขายจริงของสินค้า (preorder-capable = ปุ่มจองล่วงหน้า) */
  mode?: SaleMode
}) {
  // FIX (owner report 2026-10-01): showcase cards in admin-added sections had
  // NO add-to-cart button at all — mirror HomeProductCard's CTA behavior here.
  // UX fix 2026-10-15 (E): บังคับปุ่มเดียวต่อการ์ด — โหมดมาจากช่อง/หมวดก่อน
  // (เช่น หมวด "ส่งวันนี้" → ปุ่มตะกร้าอย่างเดียว ไม่มีปุ่มจอง/ปฏิทินซ้อน)
  // แล้วค่อย fallback เป็นโหมดขายจริงของสินค้า
  const effective: SaleMode = mode === 'auto' ? saleModeOfCategory(cat) : mode
  const isPreOrderCta = effective === 'pre_order' ? true : effective === 'same_day' ? false : item.preorder
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
        {/* ป้ายปฏิทินมุมรูป — วันจัดส่งจริงจาก menu_schedule (เฉพาะช่อง/การ์ดโหมดจอง) */}
        {isPreOrderCta && item.scheduledDate && (
          <ScheduleDateBadge date={item.scheduledDate} />
        )}
      </div>
      <div className="drink-card-body">
        <div className="drink-card-name">
          <h3 className="font-bold text-brand-accent truncate">{item.name}</h3>
          <span className="drink-card-price">฿{item.price}</span>
        </div>
        <p className="drink-card-desc">{item.description}</p>
        <div className="flex flex-col gap-2 mt-2">
          {!isPreOrderCta && item.sameDay && !soldOut && (
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
          {isPreOrderCta && item.preorder && (
            <button
              type="button"
              onClick={handlePreOrder}
              data-testid="home-showcase-preorder"
              className="btn btn-outline btn-sm w-full"
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
  mode = 'auto',
  schedule = {},
}: {
  products: Product[]
  categories: ProductCategory[]
  onSameDay: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
  /** SectionMode ของทั้งพื้นที่ — 'same_day'/'pre_order' บังคับปุ่มตามช่อง · 'auto' = ตามหมวด/สินค้า */
  mode?: SaleMode
  /** วันจัดส่งจริงจาก menu_schedule (productSchedule) — ใช้กับป้ายปฏิทินทุกใบ */
  schedule?: ProductScheduleMap
}) {
  // ระบบหัวข้อเมนูเดียว (2026-10-17): จัดกลุ่มด้วย buildHeadingGroups ตัวเดียวกับ
  // /menu — หัวข้อ (หมวดหมู่) → การ์ด · หัวข้อว่าง/ปิด = ซ่อน เหมือนกันทุกหน้า
  const groups = buildHeadingGroups(products, categories)

  let carouselIdx = 0
  const renderCategoryCarousel = (cat: ProductCategory, grouped: boolean) => {
    const items = selectHomeShowcase(products, categories, cat.id, schedule)
    if (items.length === 0) return null
    const idx = carouselIdx++
    const headingId = `home-cat-${cat.slug}`
    const pose = SECTION_POSES[idx % SECTION_POSES.length]
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
            <ShowcaseCard key={item.id} item={item} cat={cat} mode={mode} onSameDay={onSameDay} onPreOrder={onPreOrder} />
          ))}
          aria-label={`${cat.name} เลื่อนได้`}
        />
      </section>
    )
  }

  // แถวหัวข้อเมนู — เรียงตาม sort_order เหมือน /menu ทุกประการ (ไม่มีชั้นซ้อน)
  return (
    <>
      {groups.map(({ category }) => renderCategoryCarousel(category, false))}
    </>
  )
}