// ============================================
// Bite Me Baby — DrinksSection (Home) — CAT-WL-00 canonical carousel
// Data: canonical products/category slug='drinks' — ไม่มี mockup source
// Position: below pre-order menu, above the review section.
// ============================================

import { Link } from 'react-router-dom'
import { MascotBadge } from '@/components/MascotBadge'
import { HorizontalCarousel } from './HorizontalCarousel'
import { selectHomeShowcase, type HomeShowcaseItem } from '@/lib/homeShowcase'
import type { Product, ProductCategory } from '@/types'

function DrinkCard({ item }: { item: HomeShowcaseItem }) {
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
        />
      </div>
      <div className="drink-card-body">
        <div className="drink-card-name">
          <h3 className="font-bold text-brand-accent truncate">{item.name}</h3>
          <span className="drink-card-price">฿{item.price}</span>
        </div>
        <p className="drink-card-desc">{item.description}</p>
      </div>
    </article>
  )
}

export function DrinksSection({ products, categories }: { products: Product[]; categories: ProductCategory[] }) {
  const items = selectHomeShowcase(products, categories, 'drinks')
  if (items.length === 0) return null

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="home-drinks-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-drinks-heading" className="text-xl font-display font-bold text-brand-accent flex items-center gap-2">
          <MascotBadge
            pose="peeking"
            size="sm"
            alt="น้อง Bite โผล่มาส่วนเครื่องดื่ม"
            className="section-float-mascot"
          />
          <span>🥤 เครื่องดื่ม</span>
        </h2>
        <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
      </div>
      <h3 className="sr-only">เครื่องดื่ม — เมนูจริงของร้าน</h3>
      <HorizontalCarousel
        items={items.map((item) => <DrinkCard key={item.id} item={item} />)}
        aria-label="เครื่องดื่ม เลื่อนได้"
      />
    </section>
  )
}