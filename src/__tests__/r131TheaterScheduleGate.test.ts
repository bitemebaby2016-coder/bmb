// ============================================
// Bite Me Baby — R131 (Owner 2026-11-28): ปุ่มเธียเตอร์ตรงรูปแบบ HomeProductCard
//   · พรีออเดอร์ + ยังไม่ลงปฏิทิน = ปุ่มเทา (btn-locked) "ยังไม่ลงปฏิทินรอบถัดไป" กดไม่ได้
//   · พรีออเดอร์ + มีวันปฏิทินจริง = "📅 จองล่วงหน้า" กดได้
//   · เซมเดย์ = "🛒 เพิ่มลงตะกร้า"
//   · ราคาบนการ์ดดึงจากเมนูจริง (ตัด hack price:0)
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
// ============================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { RecommendationCard, TheaterHeroCard } from '@/components/theater/TheaterCards'
import type { Product } from '@/types'
import foodTheaterSrc from '../components/theater/FoodTheater.tsx?raw'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function prod(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'เมนูทดสอบ',
    price: 120,
    category_id: 'c1',
    is_available: true,
    available_preorder: true,
    available_same_day: false,
    is_preorder: true,
    image_url: '',
    description: '',
    ...over,
  } as Product
}

function renderRec(p: Product, scheduledDate?: string) {
  act(() => {
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RecommendationCard, {
          product: p,
          scheduledDate,
          onAdd: () => undefined,
        }),
      ),
    )
  })
}

function renderHero(p: Product, scheduledDate?: string) {
  act(() => {
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(TheaterHeroCard, {
          product: p,
          scheduledDate,
          onAdd: () => undefined,
          onCustomize: () => undefined,
        }),
      ),
    )
  })
}

describe('R131 — RecommendationCard ปุ่มตามโหมด/ปฏิทิน (ตรง HomeProductCard)', () => {
  it('พรีออเดอร์ + ยังไม่ลงปฏิทิน → ปุ่มเทา disabled "ยังไม่ลงปฏิทินรอบถัดไป"', () => {
    renderRec(prod())
    const btn = container.querySelector('[data-testid="theater-rec-add"]') as HTMLButtonElement | null
    expect(btn).toBeTruthy()
    expect(btn!.disabled).toBe(true)
    expect(btn!.textContent).toContain('ยังไม่ลงปฏิทินรอบถัดไป')
    expect(btn!.className).toContain('btn-locked')
  })

  it('พรีออเดอร์ + มีวันปฏิทินจริง → กดได้ "จองล่วงหน้า"', () => {
    renderRec(prod(), '2026-11-28')
    const btn = container.querySelector('[data-testid="theater-rec-add"]') as HTMLButtonElement | null
    expect(btn!.disabled).toBe(false)
    expect(btn!.textContent).toContain('จองล่วงหน้า')
    expect(btn!.className).not.toContain('btn-locked')
  })

  it('เซมเดย์ → "เพิ่มลงตะกร้า" กดได้', () => {
    renderRec(prod({ available_preorder: false, available_same_day: true, is_preorder: false }))
    const btn = container.querySelector('[data-testid="theater-rec-add"]') as HTMLButtonElement | null
    expect(btn!.disabled).toBe(false)
    expect(btn!.textContent).toContain('เพิ่มลงตะกร้า')
  })

  it('หมดแล้ว (is_available=false) → ปุ่มปิด "หมดแล้ว"', () => {
    renderRec(prod({ is_available: false }))
    const btn = container.querySelector('[data-testid="theater-rec-add"]') as HTMLButtonElement | null
    expect(btn!.disabled).toBe(true)
    expect(btn!.textContent).toContain('หมดแล้ว')
  })
})

describe('R131 — TheaterHeroCard ปุ่มตามโหมด/ปฏิทิน', () => {
  it('พรีออเดอร์ + ยังไม่ลงปฏิทิน → ปุ่มเทา disabled', () => {
    renderHero(prod())
    const btn = container.querySelector('[data-testid="theater-hero-add"]') as HTMLButtonElement | null
    expect(btn!.disabled).toBe(true)
    expect(btn!.textContent).toContain('ยังไม่ลงปฏิทินรอบถัดไป')
    expect(btn!.className).toContain('btn-locked')
  })

  it('พรีออเดอร์ + มีปฏิทิน → กดได้ "จองล่วงหน้า"', () => {
    renderHero(prod(), '2026-11-28')
    const btn = container.querySelector('[data-testid="theater-hero-add"]') as HTMLButtonElement | null
    expect(btn!.disabled).toBe(false)
    expect(btn!.textContent).toContain('จองล่วงหน้า')
  })

  it('เซมเดย์ → "เพิ่มลงตะกร้า"', () => {
    renderHero(prod({ available_preorder: false, available_same_day: true, is_preorder: false }))
    const btn = container.querySelector('[data-testid="theater-hero-add"]') as HTMLButtonElement | null
    expect(btn!.disabled).toBe(false)
    expect(btn!.textContent).toContain('ลงตะกร้า')
    expect(btn!.textContent).toContain('เพิ่ม')
  })
})

describe('R131 — FoodTheater ดึงราคา/สถานะจริงจากเมนู (ตัด hack price:0)', () => {
  it('picks mapping ใช้ real.price/real.category_id/real.is_available', () => {
    expect(foodTheaterSrc).toContain('price: real?.price ?? 0')
    expect(foodTheaterSrc).toContain("category_id: real?.category_id ?? ''")
    expect(foodTheaterSrc).toContain('is_available: real?.is_available ?? false')
  })
  it('ไม่คงค่า hack เดิม (price: 0, / is_available: true,)', () => {
    expect(foodTheaterSrc).not.toContain('price: 0,')
    expect(foodTheaterSrc).not.toContain('is_available: true,')
  })
})