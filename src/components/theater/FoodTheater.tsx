// ============================================
// Bite Me Baby — BITE FOOD THEATER (/shop hero stage)
// ============================================
// Replaces the duplicated full-screen Talk-to-Bite landing on /shop (§4 of
// the Visual Theater command) with a food-first stage:
//   AI Waiter Stage (Bite mascot + line)  ×  Menu Theater (2.5D food cards)
// REUSE ONLY — no second ordering engine:
//   - picks        → pickTopAvailable (existing pure helper, real catalog)
//   - reason chip  → recommendReason  (real memory/cart/product signals)
//   - quick add    → canonical cartStore.addItem (mode + isolation)
//   - customize    → OrderBuilder (existing detail/toppings surface)
//   - pose/state   → bitePoseForState + useBiteAIStore (visual only)
// Carousel = native CSS scroll-snap (touch swipe on mobile) + buttons + dots,
// same accessibility pattern as HorizontalCarousel. No new dependencies.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product, SameDayOrderPayload, PreOrderPayload } from '@/types'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useBiteAIStore } from '@/stores/useBiteAIStore'
import { MascotBadge } from '@/components/MascotBadge'
import { pickTopAvailable } from '@/lib/talkToBite'
import { recommendReason } from '@/lib/theaterReasons'
import { theaterPosFor, clampIndex } from '@/lib/theaterGeometry'
import { resolveTheaterEditorial, renderTheaterTitle, THEATER_EDITORIAL_DEFAULTS } from '@/lib/theaterEditorial'
import { hydrateMemoryFromServer } from '@/lib/aiServerMemory'
import { showToast } from '@/components/ui/ToastContainer'
import { TheaterHeroCard, RecommendationCard } from './TheaterCards'

const PICK_COUNT = 5

interface FoodTheaterProps {
  /** Real catalog rows already loaded by the page (single source of truth). */
  products: Product[]
  /** Open the existing OrderBuilder (detail + toppings + companions). */
  onCustomize: (payload: SameDayOrderPayload) => void
  /** Pre-order variant → existing OrderBuilder pre-order path. */
  onPreOrder: (payload: PreOrderPayload) => void
}

export function FoodTheater({ products, onCustomize, onPreOrder }: FoodTheaterProps) {
  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)
  const cartItems = useCartStore((s) => s.items)
  const setBiteState = useBiteAIStore((s) => s.setBiteState)
  const [favoriteCats, setFavoriteCats] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [editorial, setEditorial] = useState(THEATER_EDITORIAL_DEFAULTS)
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Admin-editable copy — EXISTING `business_settings` key `theater_editorial`
  // (JSON, edited via AdminSettings). Missing/unreadable → today's defaults.
  useEffect(() => {
    let active = true
    void import('@/lib/bmbAdminApi_settings')
      .then(({ getBusinessSettings }) => getBusinessSettings())
      .then((settings) => {
        if (active && settings?.theater_editorial) {
          setEditorial(resolveTheaterEditorial(settings.theater_editorial))
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  // Verified server memory only — same source TalkToBite uses for ❤️ favorites.
  useEffect(() => {
    if (!customer?.id) return
    let active = true
    void hydrateMemoryFromServer(customer.id)
      .then((mem) => {
        if (active && mem?.favorite_categories) setFavoriteCats(mem.favorite_categories)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [customer?.id])

  // Real sellable picks — deterministic featured-first ordering (no fabrication).
  const picks = useMemo(() => pickTopAvailable(products, PICK_COUNT), [products])
  const cartCategoryIds = useMemo(
    () => cartItems.map((i) => i.product.category_id).filter(Boolean),
    [cartItems],
  )

  function reasonFor(p: Product) {
    return recommendReason(p, { favoriteCats, cartCategoryIds })
  }


  // --- Carousel: native scroll-snap + buttons + dots (HorizontalCarousel pattern) ---
  function scrollTo(i: number) {
    const el = trackRef.current
    if (!el) return
    const slide = el.querySelector('[data-slide]') as HTMLElement | null
    if (!slide) return
    el.scrollTo({ left: (slide.offsetWidth + 16) * i, behavior: 'smooth' })
  }

  function go(i: number) {
    const next = Math.max(0, Math.min(picks.length - 1, i))
    setIndex(next)
    scrollTo(next)
  }

  function handleScroll() {
    const el = trackRef.current
    if (!el) return
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      const slide = el.querySelector('[data-slide]') as HTMLElement | null
      const step = slide ? slide.offsetWidth + 16 : 1
      setIndex(Math.max(0, Math.min(picks.length - 1, Math.round(el.scrollLeft / step))))
    }, 90)
  }

  useEffect(() => () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
  }, [])

  // Ring safety: when the catalog shrinks, the active index must stay in range
  // so a center card always exists (picks recompute from real products).
  useEffect(() => {
    setIndex((prev) => clampIndex(prev, picks.length))
  }, [picks.length])

  // --- Canonical add-to-cart (identical semantics to TalkToBite.addToCart) ---
  function add(p: Product, quantity: number) {
    const mode = p.available_preorder && !p.available_same_day ? 'PRE_ORDER' : 'SAME_DAY'
    const res = useCartStore.getState().addItem(p, quantity, {}, mode)
    if (res === 'added') {
      showToast(`เพิ่ม ${p.name} ลงตะกร้าแล้ว 🛒`)
      setBiteState('SUCCESS')
      window.setTimeout(() => setBiteState('IDLE'), 800)
    } else if (res === 'needs_confirmation') {
      showToast('มีสินค้ารอบอื่นในตะกร้า รอการยืนยันก่อนครับ', 'warning')
    } else {
      showToast('เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่ครับ', 'warning')
    }
  }

  function customize(p: Product) {
    if (p.available_preorder && !p.available_same_day) {
      onPreOrder({ productId: p.id, quantity: 1, deliveryRoundId: '', scheduledDate: '' })
      return
    }
    onCustomize({
      productId: p.id,
      quantity: 1,
      timestamp: new Date().toISOString(),
      availabilitySnapshot: {
        isAvailable: p.is_available,
        engineState: p.is_available ? 'available' : 'sold_out',
        source: 'live_availability_engine',
        snapshotAt: new Date().toISOString(),
      },
    })
  }

  const others = picks.filter((_, i) => i !== index)
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <section className="theater-stage" aria-label="Bite Food Theater" data-testid="food-theater">
      {/* AI waiter stage header */}
      <div className="theater-head">
        <MascotBadge pose="recommend" size="md" alt="Bite กำลังแนะนำเมนู" loading="eager" className="theater-head-mascot" />
        <div className="min-w-0 flex-1">
          <p className="theater-kicker">{editorial.kicker}</p>
          <h2 className="theater-title" data-testid="theater-title">
            {renderTheaterTitle(editorial, picks.length)}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className="theater-cart-btn"
          aria-label={`ดูตะกร้า${cartCount > 0 ? ` (${cartCount} รายการ)` : ''}`}
          data-testid="theater-cart"
        >
          🛒{cartCount > 0 ? ` ${cartCount}` : ''}
        </button>
      </div>

      {/* Empty state — real catalog says nothing sellable right now */}
      {picks.length === 0 ? (
        <div className="theater-empty" data-testid="theater-empty">
          <MascotBadge pose="cooking" size="lg" alt="Bite กำลังเตรียมเมนู" />
          <p className="text-sm text-[var(--theater-fg-muted)]">{editorial.emptyBody}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/menu')}>
            {editorial.menuCta}
          </button>
        </div>
      ) : (
        <>
          {/* MENU THEATER — scroll-snap carousel: hero + side cards in depth */}
          <div
            ref={trackRef}
            className="theater-track"
            role="list"
            tabIndex={0}
            aria-label="เมนูที่ Bite เลือกมาให้ เลื่อนได้"
            onScroll={handleScroll}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
              if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
            }}
            data-testid="theater-track"
          >
            {picks.map((p, i) => (
              <div
                key={p.id}
                data-slide
                data-pos={theaterPosFor(i, index, picks.length)}
                role="listitem"
                className={`theater-slide${i === index ? ' theater-slide--active' : ''}`}
                aria-hidden={i === index ? undefined : true}
              >
                {i === index ? (
                  <TheaterHeroCard
                    product={p}
                    reason={reasonFor(p)}
                    onAdd={add}
                    onCustomize={customize}
                  />
                ) : (
                  <RecommendationCard product={p} reason={reasonFor(p)} onAdd={(prod) => add(prod, 1)} />
                )}
              </div>
            ))}
          </div>

          {/* prev / dots / next */}
          <div className="theater-controls">
            <button
              type="button"
              className="theater-nav"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="เมนูก่อนหน้า"
              data-testid="theater-prev"
            >
              ‹
            </button>
            <div className="theater-dots" role="tablist" aria-label="สไลด์เมนู">
              {picks.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`ไปเมนูที่ ${i + 1}: ${p.name}`}
                  className={`theater-dot${i === index ? ' theater-dot--active' : ''}`}
                  onClick={() => go(i)}
                  data-testid={`theater-dot-${i}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="theater-nav"
              onClick={() => go(index + 1)}
              disabled={index >= picks.length - 1}
              aria-label="เมนูถัดไป"
              data-testid="theater-next"
            >
              ›
            </button>
          </div>

          {/* Side picks — tap to bring one forward */}
          {others.length > 0 && (
            <div className="theater-others" role="list" aria-label="อื่นที่ Bite เลือกมาให้">
              {others.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="listitem"
                  className="theater-other-chip"
                  onClick={() => go(picks.indexOf(p))}
                  data-testid="theater-other-chip"
                >
                  {p.image_url ? <img src={p.image_url} alt="" loading="lazy" decoding="async" /> : <span className="theater-other-fallback" aria-hidden="true">🍽️</span>}
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-bold text-[var(--theater-fg)] truncate">{p.name}</span>
                    <span className="block text-[11px] text-[var(--theater-price)]">฿{Number(p.price) || 0}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

