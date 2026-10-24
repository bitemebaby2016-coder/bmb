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
import { pickTopAvailable, deriveOrderMode } from '@/lib/talkToBite'
import { recommendReason } from '@/lib/theaterReasons'
import { theaterPosFor, clampIndex } from '@/lib/theaterGeometry'
import { resolveTheaterEditorial, THEATER_EDITORIAL_DEFAULTS } from '@/lib/theaterEditorial'
import { selectDailyCopy, resolveStageCopy, type TheaterDailyCopyItem } from '@/lib/theaterDailyCopy'
import { readTheaterOpen, writeTheaterOpen } from '@/lib/theaterPreferences'
import { hydrateMemoryFromServer } from '@/lib/aiServerMemory'
import { showToast } from '@/components/ui/ToastContainer'
import { TheaterHeroCard, RecommendationCard } from './TheaterCards'

const PICK_COUNT = 7

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
  const openChat = useBiteAIStore((s) => s.openChat)
  const [favoriteCats, setFavoriteCats] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  // directive §2 — "เปิด/ปิด Theater ได้": preference รายเครื่อง (default = เปิด)
  // ปิดแล้วหน้าร้านปกติ (/shop sections + /menu) ใช้ได้เสมอ — ไม่ใช่ business state
  const [theaterOpen, setTheaterOpen] = useState(() => readTheaterOpen())
  const [editorial, setEditorial] = useState(THEATER_EDITORIAL_DEFAULTS)
  // Daily rotation layer — SAME settings fetch as editorial (one swap on load).
  const [dailyCopy, setDailyCopy] = useState<TheaterDailyCopyItem | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Admin-editable copy — EXISTING `business_settings` keys `theater_editorial`
  // (base copy) + `theater_daily_copy` (7-day rotation), edited via AdminSettings.
  // Missing/unreadable → today's honest defaults (null daily = fallback chain).
  useEffect(() => {
    let active = true
    void import('@/lib/bmbAdminApi_settings')
      .then(({ getBusinessSettings }) => getBusinessSettings())
      .then((settings) => {
        if (!active) return
        if (settings?.theater_editorial) {
          setEditorial(resolveTheaterEditorial(settings.theater_editorial))
        }
        if (settings?.theater_daily_copy) {
          setDailyCopy(selectDailyCopy(settings.theater_daily_copy))
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
  // What the stage renders — daily copy → admin editorial → defaults (pure chain).
  const stage = useMemo(
    () => resolveStageCopy(editorial, dailyCopy, picks.length),
    [editorial, dailyCopy, picks.length],
  )
  const cartCategoryIds = useMemo(
    () => cartItems.map((i) => i.product.category_id).filter(Boolean),
    [cartItems],
  )

  function reasonFor(p: Product) {
    return recommendReason(p, { favoriteCats, cartCategoryIds })
  }

  // --- Theater on/off (directive §2) — ปิดได้โดยไม่กระทบการซื้อผ่านหน้าร้านปกติ ---
  function toggleTheater() {
    setTheaterOpen((prev) => {
      writeTheaterOpen(!prev)
      return !prev
    })
  }

  // --- Theater/Waiting Stage unity (directive §2): มาสคอตบนเวที = ทางเข้า
  //     Talk to Bite ชุดเดียวกับ Floating Bite (openChat → TalkToBite overlay
  //     ตัวเดียวที่ BiteMascot mount ไว้) — บริบทส่งเฉพาะสถานะจริง (route + ตะกร้า) ---
  function chatWithBite() {
    const count = cartItems.reduce((s, i) => s + i.quantity, 0)
    const context = `ลูกค้าอยู่หน้า /shop (Bite Food Theater) · มีของในตะกร้า ${count} รายการ`
    openChat(context)
    setBiteState('WELCOME')
  }


  // --- Carousel: native scroll-snap + buttons + dots (HorizontalCarousel pattern) ---
  /** Snap step = current slide width + the live CSS gap (stays correct if CSS changes). */
  function stepWidth(el: HTMLElement): number {
    const slide = el.querySelector('[data-slide]') as HTMLElement | null
    if (!slide) return 1
    const gap = Number.parseFloat(window.getComputedStyle(el).gap) || 0
    return slide.offsetWidth + gap
  }

  function scrollTo(i: number) {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: stepWidth(el) * i, behavior: 'smooth' })
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
      const step = stepWidth(el)
      // Snap-align correction: Chromium resolves a programmatic smooth-scroll target against
      // the slides' TRANSFORMED snap areas, so a jump starting from the ring "deep" state
      // (visual center sits +33px off layout) lands past the exact step multiple and is never
      // re-snapped afterwards. Track padding is symmetric, so the true snap position is always
      // i*step — nudge back first, then derive the index from the corrected offset.
      const desired = Math.round(el.scrollLeft / step) * step
      if (Math.abs(el.scrollLeft - desired) > 1) el.scrollLeft = desired
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
    // Phase 1 (OD-3 / OD-5): derive จาก canonical rule (matrix §3.1) —
    // null = ไม่มีสิทธิ์ทั้งสองโหมด → ห้าม offer (คิวเดิม reject ด้วย ERR_PRODUCT_MODE_NOT_ALLOWED)
    const mode = deriveOrderMode(p)
    if (!mode) {
      showToast('สินค้านี้ยังไม่เปิดให้สั่งในขณะนี้ค่ะ', 'warning')
      return
    }
    const res = useCartStore.getState().addItem(p, quantity, {}, mode)
    if (res === 'added') {
      showToast(`เพิ่ม ${p.name} ลงตะกร้าแล้ว 🛒`)
      setBiteState('SUCCESS')
      window.setTimeout(() => setBiteState('IDLE'), 800)
    } else {
      showToast('เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่ครับ', 'warning')
    }
  }

  function customize(p: Product) {
    // Phase 1 (OD-3): โหมดเดียวกับ add() — canonical derive เท่านั้น
    const mode = deriveOrderMode(p)
    if (!mode) {
      showToast('สินค้านี้ยังไม่เปิดให้สั่งในขณะนี้ค่ะ', 'warning')
      return
    }
    if (mode === 'PRE_ORDER') {
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
        <div className="min-w-0 flex-1">
          <p className="theater-kicker">{editorial.kicker}</p>
          <h2 className="theater-title" data-testid="theater-title">
            {stage.headline}
          </h2>
          {stage.recommendationLabel && (
            <p className="theater-daily-rec" data-testid="theater-daily-rec">{stage.recommendationLabel}</p>
          )}
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
        {/* เปิด/ปิด Theater (directive §2) — ปิดแล้วยังซื้อผ่านหน้าร้านปกติได้ */}
        <button
          type="button"
          onClick={toggleTheater}
          className="theater-cart-btn"
          aria-expanded={theaterOpen}
          aria-label={theaterOpen ? 'ปิดโรงละคร' : 'เปิดโรงละคร'}
          data-testid="theater-toggle"
        >
          {theaterOpen ? '✕' : '🎭'}
        </button>
      </div>

      {/* โรงละครปิดอยู่ — เหลือแถบสั้น + ทางเข้าหน้าร้านปกติ (ซื้อได้ตามปกติ) */}
      {!theaterOpen ? (
        <div className="theater-empty" data-testid="theater-closed">
          <p className="text-sm text-[var(--theater-fg-muted)]">
            ปิดโรงละครอยู่ — เลือกซื้อผ่านหน้าร้านปกติได้เลยครับ
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={toggleTheater} data-testid="theater-reopen">
              🎭 เปิดโรงละคร
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/menu')} data-testid="theater-closed-menu">
              {editorial.menuCta}
            </button>
          </div>
        </div>
      ) : picks.length === 0 ? (
        <div className="theater-empty" data-testid="theater-empty">
          <button
            type="button"
            onClick={chatWithBite}
            className="theater-greeting-mascot-btn"
            aria-label="คุยกับน้อง Bite"
            data-testid="theater-mascot-chat"
          >
            <MascotBadge pose="cooking" size="lg" alt="Bite กำลังเตรียมเมนู — แตะเพื่อคุย" />
          </button>
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

          {/* Stage floor — Bite ยืนบนเวทีพร้อม bubble: แตะ = เปิด Talk to Bite
              ชุดเดียวกับ Floating Bite (Theater/Waiting Stage unity — directive §2) */}
          <div className="theater-greeting" data-testid="theater-greeting">
            <button
              type="button"
              onClick={chatWithBite}
              className="theater-greeting-mascot-btn"
              aria-label="คุยกับน้อง Bite"
              data-testid="theater-mascot-chat"
            >
              <MascotBadge pose="recommend" size="md" alt="Bite กำลังแนะนำเมนู — แตะเพื่อคุย" loading="eager" className="theater-greeting-mascot" />
            </button>
            <p className="theater-greeting-bubble" data-testid="theater-subheadline">{stage.subheadline}</p>
          </div>

          {/* Daily/editorial CTA — same destination as the empty-state menu button */}
          <button
            type="button"
            className="btn btn-outline theater-menu-cta"
            onClick={() => navigate('/menu')}
            data-testid="theater-menu-cta"
          >
            {stage.ctaLabel}
          </button>

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

