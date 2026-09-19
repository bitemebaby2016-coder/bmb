// ============================================
// Bite Me Baby — DrinksSection (Home)
// Mockup drink carousel — data lives in src/lib/drinksMenu.ts (owner edits there).
// Position: below pre-order menu, above the review section.
// ============================================

import { Link } from 'react-router-dom'
import { HorizontalCarousel } from './HorizontalCarousel'
import { DRINKS_MENU, type HomeDrink } from '@/lib/drinksMenu'

function DrinkCard({ drink }: { drink: HomeDrink }) {
  return (
    <article className="drink-card" aria-label={drink.name}>
      <div className="drink-card-media">
        <img
          src={drink.image}
          alt={drink.name}
          loading="lazy"
          decoding="async"
        />
        <span className="drink-card-badge">{drink.tag}</span>
      </div>
      <div className="drink-card-body">
        <div className="drink-card-name">
          <h3 className="font-bold text-brand-accent truncate">{drink.name}</h3>
          <span className="drink-card-price">฿{drink.price}</span>
        </div>
        <p className="drink-card-desc">{drink.description}</p>
        {drink.comingSoon && <span className="drink-card-coming">🪄 เร็ว ๆ นี้</span>}
      </div>
    </article>
  )
}

export function DrinksSection() {
  if (DRINKS_MENU.length === 0) return null

  return (
    <section className="mb-10 scroll-mt-20" aria-labelledby="home-drinks-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-drinks-heading" className="text-xl font-display font-bold text-brand-accent">
          🥤 เครื่องดื่ม
        </h2>
        <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
      </div>
      <HorizontalCarousel
        items={DRINKS_MENU.map((drink) => <DrinkCard key={drink.id} drink={drink} />)}
        aria-label="เครื่องดื่ม เลื่อนได้"
      />
    </section>
  )
}