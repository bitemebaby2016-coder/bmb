// ============================================
// Bite Me Baby — BITE FOOD THEATER (/shop hero stage)
// ============================================
// Replaces the duplicated full-screen Talk-to-Bite landing on /shop (§4 of
// the Visual Theater command) with a food-first stage:
//   AI Waiter Stage (Bite mascot + line)  ×  Menu Theater (2.5D food cards)
// REUSE ONLY — no second ordering engine:
//   - picks        → pickTheaterStage / getDailyTheaterPicks (pure helpers, real catalog)
//   - reason chip  → recommendReason  (real memory/cart/product signals)
//   - quick add    → canonical cartStore.addItem (mode + isolation)
//   - customize    → OrderBuilder (existing detail/toppings surface)
//   - pose/state   → bitePoseForState + useBiteAIStore (visual only)
// Carousel = native CSS scroll-snap (touch swipe on mobile) + buttons + dots,
// same accessibility pattern as HorizontalCarousel. No new dependencies.
// Theater Carousel (Admin-curated): auto-play, scroll-snap, dots, arrows.
// Priority: Admin items (is_theater_carousel=true) → Daily random from available products.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product, SameDayOrderPayload, PreOrderPayload } from '@/types'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useBiteAIStore } from '@/stores/useBiteAIStore'
import { MascotBadge } from '@/components/MascotBadge'
import { deriveOrderMode } from '@/lib/talkToBite'
import { recommendReason } from '@/lib/theaterReasons'
import { theaterPosFor, clampIndex } from '@/lib/theaterGeometry'
import { readTheaterOpen, writeTheaterOpen } from '@/lib/theaterPreferences'
import { hydrateMemoryFromServer } from '@/lib/aiServerMemory'
import { showToast } from '@/components/ui/ToastContainer'
import { TheaterHeroCard, RecommendationCard } from './TheaterCards'

const PICK_COUNT = 7

interface TheaterCarouselItem {
  id: string
  title: string
  description: string | null
  image_url: string
  display_order: number
  product_id: string | null
  theater_caption: string | null
}

interface FoodTheaterProps {
  products: Product[]
  schedule?: Record<string, string>
  onCustomize: (payload: SameDayOrderPayload) => void
  onPreOrder: (payload: PreOrderPayload) => void
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const arr = [...array]
  let state = seed
  for (let i = arr.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function getDailyTheaterPicks(products: Product[], schedule: Record<string, string>, count: number): Product[] {
  const today = new Date().toISOString().split('T')[0]
  const seed = simpleHash(today)
  const eligible = products.filter((p) => {
    if (!p.is_available) return false
    if (p.available_preorder && !schedule[p.id]) return false
    return true
  })
  return shuffleWithSeed(eligible, seed).slice(0, count)
}

export function FoodTheater({ products, schedule = {}, onCustomize, onPreOrder }: FoodTheaterProps) {
  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)
  const cartItems = useCartStore((s) => s.items)
  const setBiteState = useBiteAIStore((s) => s.setBiteState)
  const openChat = useBiteAIStore((s) => s.openChat)
  const [favoriteCats, setFavoriteCats] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [theaterOpen, setTheaterOpen] = useState(() => readTheaterOpen())
  const [theaterItems, setTheaterItems] = useState<TheaterCarouselItem[]>([])
  const [autoplayEnabled, setAutoplayEnabled] = useState(true)
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    void import('@/lib/bmbAdminApi_portfolio')
      .then(({ getAllPortfolioItems }) => getAllPortfolioItems())
      .then((items) => {
        if (!active) return
        const theaterCarouselItems = items
          .filter((i) => i.is_theater_carousel && i.is_active)
          .sort((a, b) => a.display_order - b.display_order)
        setTheaterItems(theaterCarouselItems)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!customer?.id) return
    let active = true
    void hydrateMemoryFromServer(customer.id)
      .then((mem) => {
        if (active && mem?.favorite_categories) setFavoriteCats(mem.favorite_categories)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [customer?.id])

  const picks = useMemo(() => {
    if (theaterItems.length > 0) {
      return theaterItems.map((item) => ({
        id: item.id,
        name: item.title,
        description: item.theater_caption || item.description || '',
        image_url: item.image_url,
        price: 0,
        category_id: '',
        is_available: true,
        _theaterItem: item,
      })) as (Product & { _theaterItem: TheaterCarouselItem })[]
    }
    return getDailyTheaterPicks(products, schedule, PICK_COUNT) as (Product & { _theaterItem?: TheaterCarouselItem })[]
  }, [theaterItems, products, schedule])

  const defaultHeadline = 'Bite เลือกเมนูมาให้แล้ววันนี้'
  const defaultSubheadline = 'เลื่อนดูเมนูที่ Bite คัดสรรมาให้ · กดเพิ่มได้เลย'
  const defaultCtaLabel = 'ดูเมนูทั้งหมด'
  const defaultKicker = '🍽️ Bite Food Theater'

  const stage = useMemo(() => ({
    headline: defaultHeadline,
    subheadline: defaultSubheadline,
    ctaLabel: defaultCtaLabel,
    kicker: defaultKicker,
    recommendationLabel: '',
  }), [])

  const cartCategoryIds = useMemo(
    () => cartItems.map((i) => i.product.category_id).filter(Boolean),
    [cartItems],
  )

  function reasonFor(p: Product & { _theaterItem?: TheaterCarouselItem }) {
    if (p._theaterItem) return null
    return recommendReason(p, { favoriteCats, cartCategoryIds })
  }

  function toggleTheater() {
    setTheaterOpen((prev) => { writeTheaterOpen(!prev); return !prev })
  }

  function startAutoplay() {
    if (autoplayTimer.current) clearInterval(autoplayTimer.current)
    autoplayTimer.current = setInterval(() => {
      const next = index + 1 >= picks.length ? 0 : index + 1
      go(next)
    }, 5000)
  }

  function stopAutoplay() {
    if (autoplayTimer.current) clearInterval(autoplayTimer.current)
    autoplayTimer.current = null
  }

  useEffect(() => {
    if (autoplayEnabled && picks.length > 1) { startAutoplay() } else { stopAutoplay() }
    return () => stopAutoplay()
  }, [autoplayEnabled, picks.length])

  function handleTrackEnter() { stopAutoplay() }
  function handleTrackLeave() {
    if (autoplayEnabled && picks.length > 1) { startAutoplay() }
  }

  function chatWithBite() {
    const count = cartItems.reduce((s, i) => s + i.quantity, 0)
    const context = 'ลูกค้าอยู่หน้า /shop (Bite Food Theater) · มีของในตะกร้า ' + count + ' รายการ'
    openChat(context)
    setBiteState('WELCOME')
  }

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
      const desired = Math.round(el.scrollLeft / step) * step
      if (Math.abs(el.scrollLeft - desired) > 1) el.scrollLeft = desired
      setIndex(Math.max(0, Math.min(picks.length - 1, Math.round(el.scrollLeft / step))))
    }, 90)
  }

  useEffect(() => () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    if (autoplayTimer.current) clearInterval(autoplayTimer.current)
  }, [])

  useEffect(() => {
    setIndex((prev) => clampIndex(prev, picks.length))
  }, [picks.length])

  function add(p: Product & { _theaterItem?: TheaterCarouselItem }, quantity: number) {
    const productToAdd = p._theaterItem?.product_id
      ? products.find((prod) => prod.id === p._theaterItem!.product_id)
      : p
    if (!productToAdd) { showToast('ไม่พบสินค้าในระบบ', 'warning'); return }
    const mode = deriveOrderMode(productToAdd)
    if (!mode) { showToast('สินค้านี้ยังไม่เปิดให้สั่งในขณะนี้ค่ะ', 'warning'); return }
    if (mode === 'PRE_ORDER' && !schedule[productToAdd.id]) { showToast('เมนูนี้ยังไม่ลงปฏิทินรอบถัดไป — ยังจองไม่ได้', 'warning'); return }
    const res = useCartStore.getState().addItem(productToAdd, quantity, {}, mode)
    if (res === 'added') {
      showToast('เพิ่ม ' + productToAdd.name + ' ลงตะกร้าแล้ว 🛒')
      setBiteState('SUCCESS')
      window.setTimeout(() => setBiteState('IDLE'), 800)
    } else { showToast('เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่ครับ', 'warning') }
  }

  function customize(p: Product & { _theaterItem?: TheaterCarouselItem }) {
    const productToAdd = p._theaterItem?.product_id
      ? products.find((prod) => prod.id === p._theaterItem!.product_id)
      : p
    if (!productToAdd) { showToast('ไม่พบสินค้าในระบบ', 'warning'); return }
    const mode = deriveOrderMode(productToAdd)
    if (!mode) { showToast('สินค้านี้ยังไม่เปิดให้สั่งในขณะนี้ค่ะ', 'warning'); return }
    if (mode === 'PRE_ORDER') {
      if (!schedule[productToAdd.id]) { showToast('เมนูนี้ยังไม่ลงปฏิทินรอบถัดไป — ยังจองไม่ได้', 'warning'); return }
      onPreOrder({ productId: productToAdd.id, quantity: 1, deliveryRoundId: '', scheduledDate: '' })
      return
    }
    onCustomize({
      productId: productToAdd.id,
      quantity: 1,
      timestamp: new Date().toISOString(),
      availabilitySnapshot: {
        isAvailable: productToAdd.is_available,
        engineState: productToAdd.is_available ? 'available' : 'sold_out',
        source: 'live_availability_engine',
        snapshotAt: new Date().toISOString(),
      },
    })
  }

  const others = picks.filter((_, i) => i !== index)
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <section className='theater-stage' aria-label='Bite Food Theater' data-testid='food-theater'>
      <div className='theater-head'>
        <div className='min-w-0 flex-1'>
          <p className='theater-kicker'>{stage.kicker}</p>
          <h2 className='theater-title' data-testid='theater-title'>{stage.headline}</h2>
          {stage.recommendationLabel && <p className='theater-daily-rec' data-testid='theater-daily-rec'>{stage.recommendationLabel}</p>}
        </div>
        <button type='button' onClick={() => navigate('/cart')} className='theater-cart-btn' aria-label={'ดูตะกร้า' + (cartCount > 0 ? ' (' + cartCount + ' รายการ)' : '')} data-testid='theater-cart'>🛒{cartCount > 0 ? ' ' + cartCount : ''}</button>
        <button type='button' onClick={toggleTheater} className='theater-cart-btn' aria-expanded={theaterOpen} aria-label={theaterOpen ? 'ปิดโรงละคร' : 'เปิดโรงละคร'} data-testid='theater-toggle'>{theaterOpen ? '✕' : '🎭'}</button>
      </div>

      {!theaterOpen ? (
        <div className='theater-empty' data-testid='theater-closed'>
          <p className='text-sm text-[var(--theater-fg-muted)]'>ปิดโรงละครอยู่ — เลือกซื้อผ่านหน้าร้านปกติได้เลยครับ</p>
          <div className='flex flex-wrap items-center justify-center gap-2'>
            <button type='button' className='btn btn-primary' onClick={toggleTheater} data-testid='theater-reopen'>🎭 เปิดโรงละคร</button>
            <button type='button' className='btn btn-outline' onClick={() => navigate('/menu')} data-testid='theater-closed-menu'>{stage.ctaLabel}</button>
          </div>
        </div>
      ) : picks.length === 0 ? (
        <div className='theater-empty' data-testid='theater-empty'>
          <button type='button' onClick={chatWithBite} className='theater-greeting-mascot-btn' aria-label='คุยกับน้อง Bite' data-testid='theater-mascot-chat'><MascotBadge pose='cooking' size='lg' alt='Bite กำลังเตรียมเมนู — แตะเพื่อคุย' /></button>
          <p className='text-sm text-[var(--theater-fg-muted)]'>ยังไม่มีเมนูให้แสดงในขณะนี้</p>
          <button type='button' className='btn btn-primary' onClick={() => navigate('/menu')}>{stage.ctaLabel}</button>
        </div>
      ) : (
        <>
          <div ref={trackRef} className='theater-track' role='list' tabIndex={0} aria-label='เมนูที่ Bite เลือกมาให้ เลื่อนได้' onScroll={handleScroll} onMouseEnter={handleTrackEnter} onMouseLeave={handleTrackLeave} onTouchStart={handleTrackEnter} onTouchEnd={handleTrackLeave} onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) } if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) } }} data-testid='theater-track'>
            {picks.map((p, i) => (
              <div key={p.id} data-slide data-pos={theaterPosFor(i, index, picks.length)} role='listitem' className={'theater-slide' + (i === index ? ' theater-slide--active' : '')} aria-hidden={i === index ? undefined : true}>
                {i === index ? (
                  <TheaterHeroCard product={p} reason={reasonFor(p)} scheduledDate={p._theaterItem ? undefined : schedule[p.id]} onAdd={add} onCustomize={customize} />
                ) : (
                  <RecommendationCard product={p} reason={reasonFor(p)} scheduledDate={p._theaterItem ? undefined : schedule[p.id]} onAdd={(prod) => add(prod, 1)} />
                )}
              </div>
            ))}
          </div>

          <div className='theater-controls'>
            <button type='button' className='theater-nav' onClick={() => go(index - 1)} disabled={index === 0} aria-label='เมนูก่อนหน้า' data-testid='theater-prev'>‹</button>
            <div className='theater-dots' role='tablist' aria-label='สไลด์เมนู'>
              {picks.map((p, i) => (
                <button key={p.id} type='button' role='tab' aria-selected={i === index} aria-label={'ไปเมนูที่ ' + (i + 1) + ': ' + p.name} className={'theater-dot' + (i === index ? ' theater-dot--active' : '')} onClick={() => go(i)} data-testid={'theater-dot-' + i} />
              ))}
            </div>
            <button type='button' className='theater-nav' onClick={() => go(index + 1)} disabled={index >= picks.length - 1} aria-label='เมนูถัดไป' data-testid='theater-next'>›</button>
          </div>

          <div className='theater-greeting' data-testid='theater-greeting'>
            <button type='button' onClick={chatWithBite} className='theater-greeting-mascot-btn' aria-label='คุยกับน้อง Bite' data-testid='theater-mascot-chat'>
              <MascotBadge pose='recommend' size='md' alt='Bite กำลังแนะนำเมนู — แตะเพื่อคุย' loading='eager' className='theater-greeting-mascot' />
            </button>
            <p className='theater-greeting-bubble' data-testid='theater-subheadline'>{stage.subheadline}</p>
          </div>

          <button type='button' className='btn btn-outline theater-menu-cta' onClick={() => navigate('/menu')} data-testid='theater-menu-cta'>{stage.ctaLabel}</button>

          {others.length > 0 && (
            <div className='theater-others' role='list' aria-label='อื่นที่ Bite เลือกมาให้'>
              {others.slice(0, 3).map((p) => (
                <button key={p.id} type='button' role='listitem' className='theater-other-chip' onClick={() => go(picks.indexOf(p))} data-testid='theater-other-chip'>
                  {p.image_url ? <img src={p.image_url} alt='' loading='lazy' decoding='async' /> : <span className='theater-other-fallback' aria-hidden='true'>🍽️</span>}
                  <span className='min-w-0 text-left'>
                    <span className='block text-xs font-bold text-[var(--theater-fg)] truncate'>{p.name}</span>
                    <span className='block text-[11px] text-[var(--theater-price)]'>฿{Number(p.price) || 0}</span>
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