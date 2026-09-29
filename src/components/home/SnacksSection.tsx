// ============================================
// Bite Me Baby — SnacksSection (Home) — CAT-WL-00 canonical carousel
// Data: canonical products/category slug='snacks' — ไม่มี mockup source
// Position: below the drinks section, above the review section.
// ============================================

import { Link } from 'react-router-dom'
import { MascotBadge } from '@/components/MascotBadge'
import { HorizontalCarousel } from './HorizontalCarousel'
import { selectHomeShowcase, type HomeShowcaseItem } from '@/lib/homeShowcase'
import type { Product, ProductCategory } from '@/types'

function SnackCard({ item }: { item: HomeShowcaseItem }) {
  return (
    <article
      className="snack-card"
      aria-label={item.name}
      data-coming-soon="false"
    >
      <div className="snack-card-media">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="snack-card-body">
        <div className="snack-card-name">
          <h3 className="font-bold text-brand-accent truncate">{item.name}</h3>
          <span className="snack-card-price">฿{item.price}</span>
        </div>
        <p className="snack-card-desc">{item.description}</p>
      </div>
    </article>
  )
}

export function SnacksSection({ products, categories }: { products: Product[]; categories: ProductCategory[] }) {
  const items = selectHomeShowcase(products, categories, 'snacks')
  if (items.length === 0) return null

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="home-snacks-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-snacks-heading" className="text-xl font-display font-bold text-brand-accent flex items-center gap-2">
          <MascotBadge
            pose="peeking"
            size="sm"
            alt="น้อง Bite โผล่มาส่วนของกินเล่น"
            className="section-float-mascot"
          />
          <span>🍿 ของกินเล่น</span>
        </h2>
        <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
      </div>
      <h3 className="sr-only">ของกินเล่น — เมนูจริงของร้าน</h3>
      <HorizontalCarousel
        items={items.map((item) => <SnackCard key={item.id} item={item} />)}
        aria-label="ของกินเล่น เลื่อนได้"
      />
    </section>
  )
}