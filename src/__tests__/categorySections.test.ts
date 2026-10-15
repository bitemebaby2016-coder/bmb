// CAT (owner 2026-10-06): หมวดหมู่ที่แอดมินเพิ่มต้องโชว์บนหน้าแรกเสมอ —
// ต่อจากหมวดเดิม (sort_order) ก่อนเซกชันรีวิว — แม้ยังไม่มีสินค้า (empty state)
import { describe, expect, it, beforeAll } from 'vitest'
import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CategorySections } from '@/components/home/CategorySections'
import type { Product, ProductCategory, MenuSection } from '@/types'

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

async function renderHtml(products: Product[], categories: ProductCategory[], sections: MenuSection[] = []): Promise<string> {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await new Promise<void>((resolve) => {
    root.render(
      h(MemoryRouter, {},
        h(CategorySections, {
          products, categories, sections,
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

describe('CategorySections — จัดกลุ่ม buildCatalogGroups + หมวดว่างซ่อน (UX fix 2026-10-15)', () => {
  it('หมวดว่างถูกซ่อน (owner ยืนยัน default — ไม่โชว์การ์ดเปล่า "เร็ว ๆ นี้")', async () => {
    const existing = cat('cat-1', 'จานเดียว', 1)
    const adminAdded = cat('cat-new-1', 'สินค้าสำเร็จรูป', 6)
    const html = await renderHtml([prod('p1', 'cat-1')], [existing, adminAdded])
    expect(html).not.toContain('สินค้าสำเร็จรูป')
    expect(html).not.toContain('เร็ว ๆ นี้')
    expect(html).not.toContain('home-cat-empty-cat-new-1')
  })

  it('หมวดที่มีสินค้าโชว์เป็น carousel และเรียงตาม sort_order', async () => {
    const existing = cat('cat-1', 'จานเดียว', 1)
    const adminAdded = cat('cat-new-1', 'สินค้าสำเร็จรูป', 6)
    const html = await renderHtml([prod('p1', 'cat-1'), prod('p2', 'cat-new-1')], [existing, adminAdded])
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

  it('หมวดในหมวดหลัก (Section) ที่ปิดอยู่ = ซ่อนทั้งหมวด (ตรงกับ /menu)', async () => {
    const closedSec = { id: 's1', name: 'กลุ่มปิด', slug: 's1', sort_order: 1, is_active: false, created_at: '' } as never
    const inSec = { ...cat('cat-s', 'ในกลุ่มปิด', 1), menu_section_id: 's1' } as ProductCategory
    const html = await renderHtml([prod('p1', 'cat-s')], [inSec], [closedSec])
    expect(html).not.toContain('ในกลุ่มปิด')
  })
})