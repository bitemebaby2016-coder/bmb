// ============================================
// L-5 (N-4 #5 · Owner 2026-10-26): หน้าโหวตเมนู
//   "ภาษาไทยถูก + แสดงครบทุกเมนูจริง"
// ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Product } from '@/types'
import votePageSrc from '../pages/VotePage.tsx?raw'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  getActiveDeliveryRounds: vi.fn(),
}))
vi.mock('@/lib/bmbAdminApi_products', () => ({
  getProducts: m.getProducts,
  createProduct: m.createProduct,
  getActiveDeliveryRounds: m.getActiveDeliveryRounds,
}))
vi.mock('@/components/ui/ToastContainer', () => ({ showToast: vi.fn() }))

import { VotePage } from '@/pages/VotePage'

const prod = (id: string, name: string, over: Partial<Product> = {}): Product => ({
  id, name, description: '', price: 50, category_id: 'c1', image_url: '',
  is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
  sort_order: 0, created_at: '', ...over,
} as Product)

let container: HTMLDivElement | null = null
let root: Root | null = null

async function mount(products: Product[]) {
  m.getProducts.mockResolvedValue(products)
  m.getActiveDeliveryRounds.mockResolvedValue([])
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(React.createElement(VotePage))
    await Promise.resolve()
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

afterEach(async () => {
  if (root) { await act(async () => { root!.unmount() }) }
  if (container) container.remove()
  root = null
  container = null
  vi.clearAllMocks()
})

describe('L-5 source — ภาษาไทยถูกต้อง (พิมพ์ผิดเดิมต้องหายไป)', () => {
  it('แก้พิมพ์ผิดทั้ง 3 จุด + คงข้อความถูกต้อง', () => {
    expect(votePageSrc).toContain("showToast('คุณโหวตแล้ว กรุณารอสักครู่', 'warning')")
    expect(votePageSrc).toContain('เมนูไหนที่น่าลอง?')
    expect(votePageSrc).toContain('โหวตได้ครั้งละ 1 เมนู')
    // พิมพ์ผิดเดิมห้ามกลับมา (ใช้รูปแบบที่ไม่ชนกับข้อความถูกต้อง)
    expect(votePageSrc).not.toContain('กรุารอ')
    expect(votePageSrc).not.toContain('เมนไหนที่อย่ากลอง')
    expect(votePageSrc).not.toContain('หวตได้ครั้งละ 1 เมน</p>')
  })

  it('กรอง archived ออก ไม่กรองเฉพาะพรีออเดอร์ (ครบทุกเมนูจริง)', () => {
    expect(votePageSrc).toContain('setPollOptions(products.filter((p: Product) => !p.archived))')
    expect(votePageSrc).not.toContain('setPollOptions(products.filter((p: Product) => p.available_preorder ?? p.is_preorder))')
  })
})

describe('L-5 behavior — แสดงครบทุกเมนู (ส่งวันนี้ + พรีออเดอร์) · archived ไม่โชว์', () => {
  beforeEach(async () => {
    await mount([
      prod('p-same', 'ผัดไทยกุ้งสด', { available_same_day: true, available_preorder: false }),
      prod('p-pre', 'ข้าวเหนียวมะม่วง', { available_same_day: false, available_preorder: true }),
      prod('p-arch', 'เมนูเก่าปลดระวาง', { archived: true }),
    ])
  })

  it('เมนูส่งวันนี้ + เมนูพรีออเดอร์ โชว์ครบ · เมนูเก็บถาวรไม่โชว์ · หัวข้อไทยถูก', () => {
    const html = container!.innerHTML
    expect(html).toContain('ผัดไทยกุ้งสด')
    expect(html).toContain('ข้าวเหนียวมะม่วง')
    expect(html).not.toContain('เมนูเก่าปลดระวาง')
    expect(html).toContain('เมนูไหนที่น่าลอง?')
    expect(html).toContain('โหวตได้ครั้งละ 1 เมนู')
    expect(html).not.toContain('เมนไหนที่อย่ากลอง')
  })
})