// CAT (owner 2026-10-06): หมวดหมู่ที่แอดมินเพิ่มต้องโชว์บนหน้าแรกเสมอ —
// ต่อจากหมวดเดิม (sort_order) ก่อนเซกชันรีวิว — แม้ยังไม่มีสินค้า (empty state)
import { describe, expect, it, beforeAll } from 'vitest'
import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CategorySections } from '@/components/home/CategorySections'
import type { Product, ProductCategory } from '@/types'

// jsdom ไม่มี matchMedia — HorizontalCarousel ใช้ตรวจ reduced-motion
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
    })
  }
})

const cat = (id: string, name: string, sortOrder: number): ProductCategory =>
  ({ id, name, slug: id, icon: '🍽️', sort_order: sortOrder, is_active: true, created_at: '' } as ProductCategory)

const prod = (id: string, category_id: string): Product =>
  ({
    id, name: id, description: 'd', price: 50, category_id, image_url: 'img',
    is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
    sort_order: 0, created_at: '', updated_at: '',
  } as Product)

async function renderHtml(products: Product[], categories: ProductCategory[]): Promise<string> {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await new Promise<void>((resolve) => {
    root.render(
      h(MemoryRouter, {},
        h(CategorySections, {
          products, categories, sections: [],
          onSameDay: () => {}, onPreOrder: () => {},
        }) as never),
    )
    // flush render (act-free: effects read only props)
    setTimeout(resolve, 0)
  })
  const html = div.innerHTML
  root.unmount()
  div.remove()
  return html
}

describe('CategorySections — admin-added categories always visible on home', () => {
  it('renders an admin-added category with zero products as an empty section (not hidden)', async () => {
    const existing = cat('cat-1', 'จานเดียว', 1)
    const adminAdded = cat('cat-new-1', 'สินค้าสำเร็จรูป', 6)
    const html = await renderHtml([prod('p1', 'cat-1')], [existing, adminAdded])
    expect(html).toContain('สินค้าสำเร็จรูป')
    expect(html).toContain('เร็ว ๆ นี้')
    expect(html).toContain('home-cat-empty-cat-new-1')
  })

  it('keeps existing categories with products as carousels and orders sections by sort_order', async () => {
    const existing = cat('cat-1', 'จานเดียว', 1)
    const adminAdded = cat('cat-new-1', 'สินค้าสำเร็จรูป', 6)
    const html = await renderHtml([prod('p1', 'cat-1')], [existing, adminAdded])
    const iExisting = html.indexOf('จานเดียว')
    const iNew = html.indexOf('สินค้าสำเร็จรูป')
    expect(iExisting).toBeGreaterThanOrEqual(0)
    expect(iNew).toBeGreaterThan(iExisting)
    expect(html).toContain('home-showcase-add-to-cart')
  })

  it('still hides archived categories entirely', async () => {
    const archived = { ...cat('cat-arch', 'หมวดปิด', 2), archived: true } as ProductCategory
    const html = await renderHtml([], [archived])
    expect(html).not.toContain('หมวดปิด')
  })
})