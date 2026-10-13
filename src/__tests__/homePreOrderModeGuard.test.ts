/**
 * Phase 2 — Cart/Checkout consistency (RC-3 · OD-4)
 *
 * Page-level test ของ HomePage.handlePreOrder:
 *  - ตะกร้าล็อกโหมดอื่นอยู่ → addItem คืน 'needs_confirmation' → ห้าม navigate ไป /checkout
 *    (ให้ CartIsolationModal ยืนยันตามกลไกเดิม — lock ชนะ ไม่สลับเงียบ ๆ)
 *  - ตะกร้าว่าง/ตรงโหมด → เพิ่มได้ → navigate /checkout?mode=pre-order ตามเดิม
 *
 * NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Product, PreOrderPayload } from '@/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// jsdom ไม่มี matchMedia/ResizeObserver — components หน้าแรกใช้ (polyfill เฉพาะ test นี้)
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
if (typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as Record<string, unknown>).ResizeObserver = RO
}

const m = vi.hoisted(() => ({
  openBuilder: vi.fn(),
  getProducts: vi.fn(),
  getCategories: vi.fn(),
  getSections: vi.fn(),
  getDeliveryRoundsAdmin: vi.fn(),
  getPromotionsAdmin: vi.fn(),
  getVerifiedReviewsForProducts: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('@/store/orderBuilderStore', () => ({
  useOrderBuilderStore: {
    getState: () => ({ openBuilder: m.openBuilder }),
  },
}))

vi.mock('@/lib/bmbAdminApi_products', () => ({
  getProducts: m.getProducts,
  getCategories: m.getCategories,
  getSections: m.getSections,
}))

vi.mock('@/lib/bmbAdminApi_rounds', () => ({
  getDeliveryRoundsAdmin: m.getDeliveryRoundsAdmin,
}))

vi.mock('@/lib/bmbAdminApi_promotions', () => ({
  getPromotionsAdmin: m.getPromotionsAdmin,
}))

vi.mock('@/lib/reviewApi', () => ({
  getVerifiedReviewsForProducts: m.getVerifiedReviewsForProducts,
}))

vi.mock('@/components/ui/ToastContainer', () => ({
  showToast: m.showToast,
}))

// lazy FoodTheater ถูกตัดออก — ไม่เกี่ยวกับ flow ที่ test (ทำให้ render เบา/เร็ว)
vi.mock('@/components/theater/FoodTheater', () => ({
  FoodTheater: () => null,
}))

import { HomePage } from '@/pages/HomePage'
import { useCartStore } from '@/store/cartStore'

function product(id: string, opts: Partial<Product> = {}): Product {
  return {
    id,
    name: `สินค้า ${id}`,
    description: '',
    price: 100,
    category_id: '',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 0,
    sort_order: 0,
    created_at: '',
    ...opts,
  } as Product
}

const SD_PRODUCT = product('sd-1', { available_same_day: true, available_preorder: false })
const PRE_PRODUCT = product('pre-1', { is_preorder: true, available_same_day: false, available_preorder: true })

let container: HTMLDivElement
let root: Root
let lastPath = '/'
let lastSearch = ''

function LocationProbe() {
  const loc = useLocation()
  lastPath = loc.pathname
  lastSearch = loc.search
  return null
}

type BuilderCb = (result: {
  product: Product
  quantity: number
  addOns: unknown[]
  recommended: Product[]
}) => void
let capturedCb: BuilderCb | null = null

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

async function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        React.createElement(LocationProbe),
        React.createElement(HomePage),
      ),
    )
  })
  await flush()
}

function resetCart() {
  useCartStore.setState({
    items: [],
    order_mode: null,
    pendingMode: null,
    subtotal: 0,
    discount: 0,
    deliveryFee: 0,
    total: 0,
    cartTotal: 0,
    couponCode: '',
    appliedPromotion: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetCart()
  capturedCb = null
  lastPath = '/'
  lastSearch = ''
  m.getProducts.mockResolvedValue([SD_PRODUCT, PRE_PRODUCT])
  m.getCategories.mockResolvedValue([])
  m.getSections.mockResolvedValue([])
  m.getDeliveryRoundsAdmin.mockResolvedValue([])
  m.getPromotionsAdmin.mockResolvedValue([])
  m.getVerifiedReviewsForProducts.mockResolvedValue([])
  m.openBuilder.mockImplementation((_p: Product, _all: Product[], cb: BuilderCb) => {
    capturedCb = cb
  })
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  resetCart()
})

describe('HomePage.handlePreOrder — AddToCartResult guard (RC-3 · OD-4)', () => {
  it('M1 2D-1: mode-mismatch add → mixed line KEPT (no discard, no silent switch) → navigate /checkout?mode=pre-order', async () => {
    // ล็อกตะกร้าด้วย SAME_DAY ก่อน
    const lockRes = useCartStore.getState().addItem(SD_PRODUCT, 1, {}, 'SAME_DAY')
    expect(lockRes).toBe('added')
    expect(useCartStore.getState().order_mode).toBe('SAME_DAY')

    await mount()
    await clickPreOrderCta()
    expect(capturedCb).toBeTruthy()

    // M1: addItem(PRE_ORDER) คืน 'added' — ใส่เป็น line ตัวเอง ไม่ discard ไม่สลับโหมดเงียบ ๆ
    await act(async () => {
      capturedCb!({ product: PRE_PRODUCT, quantity: 1, addOns: [], recommended: [] })
    })
    await flush()

    const st = useCartStore.getState()
    expect(st.pendingMode).toBeNull()
    expect(st.items.length).toBe(2) // ทั้งสองบรรทัดอยู่ครบ
    expect(st.order_mode).toBe('SAME_DAY') // primary mode คงเดิม
    expect((st.items[1] as { line_mode?: string }).line_mode).toBe('PRE_ORDER')
    expect(lastPath).toBe('/checkout')
  })

  it('added (ไม่มี conflict) → navigate /checkout?mode=pre-order ตามเดิม', async () => {
    await mount()
    await clickPreOrderCta()
    expect(capturedCb).toBeTruthy()

    await act(async () => {
      capturedCb!({ product: PRE_PRODUCT, quantity: 1, addOns: [], recommended: [] })
    })
    await flush()

    const st = useCartStore.getState()
    expect(st.order_mode).toBe('PRE_ORDER')
    expect(st.items.some((i) => i.product.id === PRE_PRODUCT.id)).toBe(true)
    expect(lastPath).toBe('/checkout')
    expect(lastSearch).toContain('mode=pre-order')
  })
})

async function clickPreOrderCta() {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => (b.textContent || '').trim() === '📅 จองล่วงหน้า',
  )
  expect(btn, 'ปุ่ม "📅 จองล่วงหน้า" ไม่พบบนหน้าแรก').toBeTruthy()
  await act(async () => {
    ;(btn as HTMLButtonElement).click()
  })
  await flush()
}
