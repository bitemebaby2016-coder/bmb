// ============================================
// Bite Me Baby — SnacksSection (Home)
// Mockup snacks carousel — data lives in src/lib/snacksMenu.ts (owner edits there).
// Position: below the drinks section, above the review section.
// ============================================

import { Link } from 'react-router-dom'
import { MascotBadge } from '@/components/MascotBadge'
import { HorizontalCarousel } from './HorizontalCarousel'
import { SNACKS_MENU, type HomeSnack } from '@/lib/snacksMenu'

function SnackCard({ snack }: { snack: HomeSnack }) {
  const isComingSoon = !!snack.comingSoon
  return (
    <article
      className="snack-card"
      aria-label={snack.name}
      data-coming-soon={isComingSoon ? "true" : "false"}
    >
      <div className="snack-card-media">
        <img
          src={snack.image}
          alt={snack.name}
          loading="lazy"
          decoding="async"
        />
        <span className="snack-card-badge">{snack.tag}</span>
        {isComingSoon && (
          <div className="snack-card-coming-soon-overlay" aria-hidden="true">
            <span>🪄 เร็ว ๆ นี้ — ยังไม่สามารถสั่งได้</span>
          </div>
        )}
      </div>
      <div className="snack-card-body">
        <div className="snack-card-name">
          <h3 className="font-bold text-brand-accent truncate">{snack.name}</h3>
          <span className="snack-card-price">฿{snack.price}</span>
        </div>
        <p className="snack-card-desc">{snack.description}</p>
        {isComingSoon && <span className="snack-card-coming">🪄 เร็ว ๆ นี้</span>}
      </div>
    </article>
  )
}

export function SnacksSection() {
  if (SNACKS_MENU.length === 0) return null

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
      <h3 className="sr-only">ของกินเล่น — ของว่าง/ขนม</h3>
      <HorizontalCarousel
        items={SNACKS_MENU.map((snack) => <SnackCard key={snack.id} snack={snack} />)}
        aria-label="ของกินเล่น เลื่อนได้"
      />
    </section>
  )
}