// ============================================
// L-5 (N-4 #5 · Owner 2026-10-26) + R53 (Owner 2026-11-18): หน้าโหวตเมนู
//   "ภาษาไทยถูก + แสดงครบทุกเมนูจริง + โหวตจริงจาก server (ZERO-FAKE)"
// ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import type { Product } from '@/types'
import votePageSrc from '../pages/VotePage.tsx?raw'

/** ตัด comment ออกก่อนตรวจ not.toContain (comment อธิบายเหตุผลเดิมพูดถึงสิ่งที่เคยผิด) —
 *  split ด้วย /\r?\n/ กัน CRLF ทำให้ strip ไม่หมด (convention จาก canonicalFallbackContract) */
const stripComments = (src: string) =>
  src
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({
  getProducts: vi.fn(),
  fetchVoteStatus: vi.fn(),
  castPreorderVote: vi.fn(),
  describeVoteIssue: vi.fn((r: string) => `issue:${r}`),
  getPromotionsWithStatus: vi.fn(),
  isPromoLiveNow: vi.fn(() => true),
  promoDiscountLabel: vi.fn(() => 'ลด 10%'),
}))
vi.mock('@/lib/bmbAdminApi_products', () => ({
  getProducts: m.getProducts,
  createProduct: m.getProducts, // ห้ามถูกเรียกจากหน้าโหวต (R53: ลบ createProduct ออกแล้ว)
}))
vi.mock('@/lib/voteClient', () => ({
  fetchVoteStatus: m.fetchVoteStatus,
  castPreorderVote: m.castPreorderVote,
  describeVoteIssue: m.describeVoteIssue,
}))
vi.mock('@/lib/bmbAdminApi_promotions', () => ({
  getPromotionsWithStatus: m.getPromotionsWithStatus,
}))
vi.mock('@/pages/PromotionsPage', () => ({
  isPromoLiveNow: m.isPromoLiveNow,
  promoDiscountLabel: m.promoDiscountLabel,
}))
vi.mock('@/components/ui/ToastContainer', () => ({ showToast: vi.fn() }))

import { VotePage } from '@/pages/VotePage'

const prod = (id: string, name: string, over: Partial<Product> = {}): Product => ({
  id, name, description: '', price: 50, category_id: 'c1', image_url: '',
  is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
  sort_order: 0, created_at: '', ...over,
} as Product)

const voteStatus = (over: Record<string, unknown> = {}) => ({
  policy: { enabled: true, daily_limit: 1 },
  used_today: 0,
  remaining_today: 1,
  tallies: {},
  myVotes: [],
  ...over,
})

let container: HTMLDivElement | null = null
let root: Root | null = null

/** status = สถานะโหวตจริงจาก server (ตั้งก่อน mount เสมอ — component consume ทันทีที่ mount) */
async function mount(products: Product[], status?: Record<string, unknown>) {
  m.getProducts.mockResolvedValue(products)
  m.fetchVoteStatus.mockResolvedValue(voteStatus(status ?? {}))
  m.getPromotionsWithStatus.mockResolvedValue({ rows: [], ok: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(React.createElement(MemoryRouter, null, React.createElement(VotePage)))
    await Promise.resolve()
  })
  await act(async () => { vi.advanceTimersByTimeAsync(0) })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(async () => {
  if (root) { await act(async () => { root!.unmount() }) }
  if (container) container.remove()
  root = null
  container = null
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.clearAllTimers()
})

describe('R53 source — ห้ามของปลอมในหน้าโหวตอีกต่อไป (ZERO-FAKE)', () => {
  it('ห้าม createProduct (โหวตต้องไม่สร้างสินค้าซ้ำใน DB) + ห้าม addPoints แต้มปลอม', () => {
    const code = stripComments(votePageSrc)
    expect(code).not.toContain('createProduct')
    expect(code).not.toContain('addPoints')
    expect(code).not.toContain('useRewardsStore')
    // สัญญาแต้มปลอมเดิมห้ามกลับมา ("5 แต้ม" / แลกคูปอง)
    expect(code).not.toContain('5 แต้ม')
    expect(code).not.toContain('แลกคูปอง')
    // % ปลอมจาก prep_minutes ห้ามกลับมา
    expect(code).not.toContain('prep_minutes')
  })

  it('โหวตจริงผ่าน server RPC + ผลจริงจาก fetchVoteStatus', () => {
    expect(votePageSrc).toContain('castPreorderVote')
    expect(votePageSrc).toContain('fetchVoteStatus')
    expect(votePageSrc).toContain('describeVoteIssue')
  })

  it('ภาษาไทยถูกต้อง (พิมพ์ผิดเดิมต้องหายไป)', () => {
    expect(votePageSrc).toContain('เมนูไหนที่น่าลอง?')
    expect(votePageSrc).toContain('โหวตครั้งละ 1 เมนูต่อวัน')
    expect(votePageSrc).not.toContain('กรุารอ')
    expect(votePageSrc).not.toContain('เมนไหนที่อย่ากลอง')
  })

  it('กรอง archived ออก ไม่กรองเฉพาะพรีออเดอร์ (ครบทุกเมนูจริง)', () => {
    expect(votePageSrc).toContain('setPollOptions(products.filter((p: Product) => !p.archived))')
    expect(votePageSrc).not.toContain('setPollOptions(products.filter((p: Product) => p.available_preorder ?? p.is_preorder))')
  })

  it('ซิงกระบบโปรโมชันจริงจากแอดมิน (แสดงเมื่อมีจริงเท่านั้น)', () => {
    expect(votePageSrc).toContain('getPromotionsWithStatus')
    expect(votePageSrc).toContain('isPromoLiveNow')
    expect(votePageSrc).toContain('โปรโมชั่นที่กำลังรัน')
  })
})

describe('R53 behavior — จำนวนโหวต/% แสดงจาก tallies จริงของ server', () => {
  it('เมนูส่งวันนี้ + เมนูพรีออเดอร์ โชว์ครบ · เมนูเก็บถาวรไม่โชว์ · หัวข้อไทยถูก', async () => {
    await mount([
      prod('p-same', 'ผัดไทยกุ้งสด', { available_same_day: true, available_preorder: false }),
      prod('p-pre', 'ข้าวเหนียวมะม่วง', { available_same_day: false, available_preorder: true }),
      prod('p-arch', 'เมนูเก่าปลดระวาง', { archived: true }),
    ])
    const html = container!.innerHTML
    expect(html).toContain('ผัดไทยกุ้งสด')
    expect(html).toContain('ข้าวเหนียวมะม่วง')
    expect(html).not.toContain('เมนูเก่าปลดระวาง')
    expect(html).toContain('เมนูไหนที่น่าลอง?')
    expect(html).not.toContain('เมนไหนที่อย่ากลอง')
  })

  it('ตัวเลขโหวต = 0 จริงเมื่อไม่มีใครโหวต (ไม่มี % ปลอม) + เพดานจาก server', async () => {
    await mount([prod('p-a', 'เมนู A')])
    const html = container!.innerHTML
    expect(html).toContain('0 โหวต (0%)')
    expect(html).toContain('วันนี้โหวตได้อีก 1 เมนู')
  })
})

describe('R53 behavior — เมนูที่โหวตไว้แล้ว (myVotes จาก server) ติดป้ายและกันกดซ้ำ', () => {
  it('แสดงผลจริงต่อเมนู (3/1) + เมนูที่โหวตไว้มีเครื่องหมาย ✓ + แจ้งโหวตครบวัน', async () => {
    await mount(
      [prod('p-a', 'เมนู A'), prod('p-b', 'เมนู B')],
      { used_today: 1, remaining_today: 0, tallies: { 'p-a': 3, 'p-b': 1 }, myVotes: ['p-a'] },
    )
    const html = container!.innerHTML
    expect(html).toContain('3 โหวต (75%)')
    expect(html).toContain('1 โหวต (25%)')
    expect(html).toContain('✅')
    expect(html).toContain('โหวตครบจำนวนของวันนี้แล้ว')
  })
})

describe('R53 behavior — policy ปิด = บอกตรง ๆ (ไม่แสร้งว่าโหวตได้)', () => {
  it('แจ้งยังไม่เปิดโหวต + ไม่มีเส้นทางโหวตจากหน้า', async () => {
    await mount([prod('p-a', 'เมนู A')], { policy: { enabled: false, daily_limit: 1 } })
    const html = container!.innerHTML
    expect(html).toContain('ยังไม่เปิดการโหวต')
  })
})
