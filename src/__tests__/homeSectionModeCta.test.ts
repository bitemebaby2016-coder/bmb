// Phase 5B (A1 · RC-5 UX · RC-4 dedupe · INV-16/INV-19 · OD-3):
// การ์ดใน section ต้องมี CTA ตามโหมดของ section — ไม่ใช่ตามข้อมูลสินค้าเพียงอย่างเดียว
// + dedupe invariant ระดับคารูเซล (per-surface) — UX fix 2026-10-15 (E):
//   บังคับปุ่มเดียวต่อการ์ดทุกช่อง (A2 ปลด DEFERRED — auto ใช้โหมดขายจริงของสินค้า)
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { HomeProductCard } from '@/components/home/HomeProductCard'
import { CategorySections } from '@/components/home/CategorySections'
import { getHomeProducts } from '@/lib/homeProviders'
import { saleModeOfCategory } from '@/lib/catalogStructure'
import type { HomeProduct, Product, ProductCategory } from '@/types'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // jsdom ไม่มี matchMedia — HorizontalCarousel ใช้ตรวจ reduced-motion
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: false, media: q, onchange: null,
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
        dispatchEvent: () => false,
      }),
    })
  }
})

function mount(el: ReactElement): { container: HTMLDivElement; root: Root; flush: () => Promise<void> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(el)
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
  return { container, root, flush }
}

/** สินค้า dual-mode (มีสิทธิ์ทั้งสองโหมด) — ใช้ตรวจ section-wins ทุกกรณี */
const dualItem = (over: Partial<HomeProduct> = {}): HomeProduct => ({
  id: 'p-dual', name: 'ลุยสวนหมู+กุ้ง', image: '', price: 79, description: '', category_id: 'c1',
  mode: 'same-day', availability: 'available', stock: 10, cta: '🛒 เพิ่มลงตะกร้า',
  ...over,
} as HomeProduct)

async function renderCard(item: HomeProduct, mode?: 'same_day' | 'pre_order' | 'auto') {
  const onSameDay = vi.fn()
  const onPreOrder = vi.fn()
  const { container, root, flush } = mount(h(HomeProductCard, { item, onSameDay, onPreOrder, mode }))
  await flush()
  const cta = container.querySelector('[data-testid="home-card-cta"]') as HTMLButtonElement
  return { onSameDay, onPreOrder, cta, root, container }
}

describe('A1 · HomeProductCard CTA ตาม section mode (INV-16)', () => {
  it("section same_day: การ์ดมีเฉพาะ 'เพิ่มลงตะกร้า' แม้ข้อมูล item เป็น pre-order + click เรียก onSameDay เท่านั้น", async () => {
    const { cta, onSameDay, onPreOrder, root, container } = await renderCard(dualItem({ mode: 'pre-order' }), 'same_day')
    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons).toHaveLength(1)
    expect(cta.textContent).toContain('เพิ่มลงตะกร้า')
    expect(cta.textContent).not.toContain('จองล่วงหน้า')
    cta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSameDay).toHaveBeenCalledTimes(1)
    expect(onPreOrder).not.toHaveBeenCalled()
    root.unmount()
    container.remove()
  })

  it("section pre_order: การ์ดมีป้ายปฏิทิน → 'จองล่วงหน้า' เท่านั้น + click เรียก onPreOrder เท่านั้น", async () => {
    const { cta, onSameDay, onPreOrder, root, container } = await renderCard(dualItem({ mode: 'same-day', scheduledDate: '2026-10-20' }), 'pre_order')
    expect(cta.textContent).toContain('จองล่วงหน้า')
    expect(cta.textContent).not.toContain('เพิ่มลงตะกร้า')
    cta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onPreOrder).toHaveBeenCalledTimes(1)
    expect(onSameDay).not.toHaveBeenCalled()
    root.unmount()
    container.remove()
  })

  it('R5c: section pre_order แต่การ์ดไม่มีป้ายปฏิทิน → ปุ่ม disabled "ยังไม่ลงปฏิทิน" (ไม่มีพรีออเดอร์วันอิสระ)', async () => {
    const { cta, onSameDay, onPreOrder, root, container } = await renderCard(dualItem({ mode: 'same-day' }), 'pre_order')
    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons).toHaveLength(1) // INV-16: ปุ่มเดียวต่อการ์ด ไม่มีปุ่มอีกโหมด
    expect(cta.textContent).toContain('ยังไม่ลงปฏิทิน')
    expect(cta.disabled).toBe(true)
    cta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSameDay).not.toHaveBeenCalled()
    expect(onPreOrder).not.toHaveBeenCalled()
    root.unmount()
    container.remove()
  })

  it("mode auto (default): พฤติกรรมเดิม — item.mode กำหนด CTA ทั้งสองทิศ", async () => {
    const a = await renderCard(dualItem({ mode: 'pre-order', scheduledDate: '2026-10-20' }))
    expect(a.cta.textContent).toContain('จองล่วงหน้า')
    a.root.unmount()
    a.container.remove()
    const b = await renderCard(dualItem({ mode: 'same-day' }))
    expect(b.cta.textContent).toContain('เพิ่มลงตะกร้า')
    b.root.unmount()
    b.container.remove()
  })

  it('sold_out: disabled + ป้าย "หมดแล้ว" ทุก mode', async () => {
    const { cta, root, container } = await renderCard(dualItem({ availability: 'sold_out' }), 'same_day')
    expect(cta.disabled).toBe(true)
    expect(cta.textContent).toContain('หมดแล้ว')
    root.unmount()
    container.remove()
  })
})

describe('A1 · ShowcaseCard mode-aware ผ่าน CategorySections (INV-16 · OD-3)', () => {
  const cat = (id: string, name: string, sortOrder: number): ProductCategory =>
    ({ id, name, slug: id, icon: '🍽️', sort_order: sortOrder, is_active: true, created_at: '' } as ProductCategory)

  const prod = (id: string, over: Partial<Product> = {}): Product =>
    ({
      id, name: id, description: 'd', price: 50, category_id: 'c1', image_url: 'img',
      is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
      sort_order: 0, created_at: '', updated_at: '',
      ...over,
    } as Product)

  async function renderSections(products: Product[], mode?: 'same_day' | 'pre_order' | 'auto', catName = 'จานเดียว', schedule: Record<string, string> = {}) {
    const categories = [cat('c1', catName, 1)]
    const { container, root, flush } = mount(
      h(MemoryRouter, {},
        h(CategorySections, {
          products, categories, sections: [],
          onSameDay: () => {}, onPreOrder: () => {}, mode, schedule,
        } as never)),
    )
    await flush()
    return { html: container.innerHTML, root, container }
  }

  const dualProd = () =>
    prod('p-dual', { available_same_day: true, available_preorder: true, is_preorder: false })

  it("mode=same_day: สินค้า dual ไม่มีปุ่ม 'จองล่วงหน้า'", async () => {
    const { html, root, container } = await renderSections([dualProd()], 'same_day')
    expect(html).toContain('home-showcase-add-to-cart')
    expect(html).not.toContain('home-showcase-preorder')
    root.unmount()
    container.remove()
  })

  it("mode=pre_order: สินค้า dual ไม่มีปุ่ม 'เพิ่มลงตะกร้า'", async () => {
    const { html, root, container } = await renderSections([dualProd()], 'pre_order')
    expect(html).toContain('home-showcase-preorder')
    expect(html).not.toContain('home-showcase-add-to-cart')
    root.unmount()
    container.remove()
  })

  it("default (auto): สินค้า dual แสดงปุ่มเดียวตามโหมดขายจริง (ปุ่มจองล่วงหน้า) — บังคับปุ่มเดียวต่อการ์ด (A2)", async () => {
    const { html, root, container } = await renderSections([dualProd()])
    expect(html).toContain('home-showcase-preorder')
    expect(html).not.toContain('home-showcase-add-to-cart')
    root.unmount()
    container.remove()
  })

  it("หมวด 'ส่งวันนี้ / Same Day' (auto): สินค้า dual แสดงเฉพาะปุ่มเพิ่มลงตะกร้า — ไม่มีปุ่มจอง/ไม่มีปฏิทินซ้อน", async () => {
    const { html, root, container } = await renderSections([dualProd()], 'auto', 'ส่งวันนี้ / Same Day', { 'p-dual': '2026-10-20' })
    expect(html).toContain('home-showcase-add-to-cart')
    expect(html).not.toContain('home-showcase-preorder')
    expect(html).not.toContain('schedule-date-badge')
    root.unmount()
    container.remove()
  })

  it("หมวด 'จองล่วงหน้า / พรีออเดอร์' (auto): สินค้า dual แสดงเฉพาะปุ่มจองล่วงหน้า + ป้ายปฏิทินวันจาก menu_schedule", async () => {
    const { html, root, container } = await renderSections([dualProd()], 'auto', 'จองล่วงหน้า / พรีออเดอร์', { 'p-dual': '2026-10-20' })
    expect(html).toContain('home-showcase-preorder')
    expect(html).not.toContain('home-showcase-add-to-cart')
    expect(html).toContain('schedule-date-badge')
    root.unmount()
    container.remove()
  })

  it("OD-3: สินค้าไร้สิทธิ์ทั้งสองโหมด (available_same_day=false & available_preorder=false) ไม่มีปุ่มสั่งใด ๆ", async () => {
    const none = prod('p-none', { available_same_day: false, available_preorder: false, is_preorder: false })
    const { html, root, container } = await renderSections([none])
    expect(html).not.toContain('home-showcase-add-to-cart')
    expect(html).not.toContain('home-showcase-preorder')
    root.unmount()
    container.remove()
  })
})

describe('RC-4 · dedupe ระดับคารูเซล (INV-19 — per-surface, cross-surface = A2 deferred)', () => {
  const cat = { id: 'c1', name: 'จานเดียว', slug: 'c1', icon: 'x', sort_order: 1, is_active: true, created_at: '' } as ProductCategory
  const prod = (id: string, over: Partial<Product> = {}): Product =>
    ({
      id, name: id, description: 'd', price: 50, category_id: 'c1', image_url: 'img',
      is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
      sort_order: 0, created_at: '', updated_at: '',
      ...over,
    } as Product)

  it('getHomeProducts ไม่คืน id ซ้ำใน carousel เดียวกันแม้ rows ซ้ำจาก data/API', () => {
    const p1 = prod('p-1', { available_same_day: true, available_preorder: false, is_preorder: false })
    const p2 = prod('p-2', { available_same_day: false, available_preorder: true, is_preorder: true })
    const { sameDay, preOrder } = getHomeProducts([p1, p1, p1, p2, p2], [cat])
    expect(sameDay.filter((i) => i.id === 'p-1')).toHaveLength(1)
    expect(preOrder.filter((i) => i.id === 'p-2')).toHaveLength(1)
    expect(new Set(sameDay.map((i) => i.id)).size).toBe(sameDay.length)
    expect(new Set(preOrder.map((i) => i.id)).size).toBe(preOrder.length)
  })

  it('สินค้า dual-mode ไปอยู่ preOrder carousel เท่านั้น (else-if เดิม — ไม่ใช่ duplication)', () => {
    const dual = prod('p-dual', { available_same_day: true, available_preorder: true, is_preorder: false })
    const { sameDay, preOrder } = getHomeProducts([dual], [cat])
    expect(preOrder.map((i) => i.id)).toEqual(['p-dual'])
    expect(sameDay).toHaveLength(0)
  })
})

describe('E · saleModeOfCategory — หมวด/ช่องผูกโหมดขาย (SectionMode)', () => {
  it("maps ชื่อหมวด → SaleMode: 'ส่งวันนี้' → same_day · 'จองล่วงหน้า/พรีออเดอร์' → pre_order · อื่น ๆ → auto", () => {
    expect(saleModeOfCategory({ name: 'ส่งวันนี้ / Same Day', slug: 'same-day' })).toBe('same_day')
    expect(saleModeOfCategory({ name: 'จองล่วงหน้า / พรีออเดอร์', slug: 'preorder' })).toBe('pre_order')
    expect(saleModeOfCategory({ name: 'จานเดียว', slug: 'dish' })).toBe('auto')
    expect(saleModeOfCategory({ name: 'เครื่องดื่ม', slug: 'drinks' })).toBe('auto')
  })
})