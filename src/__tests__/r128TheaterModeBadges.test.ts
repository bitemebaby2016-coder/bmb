// ============================================
// Bite Me Baby — R128 (Owner 2026-11-27): badge ประเภทเมนูบนเธียเตอร์
//   มุมรูปขวาบน: ปฏิทินวันจัดส่งจริง / "📅 ยังไม่ลงปฏิทิน" / "⚡ ส่งวันนี้"
//   รูปแบบเดียวกันทั้ง HeroCard + RecommendationCard และของแอดมิน
//   ที่ผูก product_id ก็ได้ปฏิทิน/ประเภทจากเมนูจริง (ตัด hack undefined เดิม)
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
// ============================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { ModeCornerBadge } from '@/components/theater/TheaterCards'
import foodTheaterSrc from '../components/theater/FoodTheater.tsx?raw'
import theaterCardsSrc from '../components/theater/TheaterCards.tsx?raw'

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

function renderBadge(props: { mode: 'SAME_DAY' | 'PRE_ORDER' | null; scheduledDate?: string; className?: string; testId?: string }) {
  act(() => {
    root.render(
      React.createElement(ModeCornerBadge, {
        className: 'absolute top-2 right-2 z-20',
        testId: 'theater-hero',
        ...props,
      }),
    )
  })
}

describe('R128 — ModeCornerBadge มุมรูปเดียวกันทุกโหมด', () => {
  it('มีวันจัดส่งจริง → ปฏิทินลอยมาตรฐาน (ScheduleDateBadge เดียวกับหน้า /menu) มุมเดิม', () => {
    renderBadge({ mode: 'PRE_ORDER', scheduledDate: '2026-11-28' })
    expect(container.querySelector('[data-testid="theater-hero-cal"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="schedule-date-badge"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="schedule-date-calendar"]')).toBeTruthy()
  })

  it('พรีออเดอร์ + ยังไม่ลงปฏิทิน → ป้าย "📅 ยังไม่ลงปฏิทิน" มุมเดิม ไม่มีปฏิทิน', () => {
    renderBadge({ mode: 'PRE_ORDER' })
    const el = container.querySelector('[data-testid="theater-hero-unscheduled"]')
    expect(el?.textContent).toContain('ยังไม่ลงปฏิทิน')
    expect(container.querySelector('[data-testid="schedule-date-badge"]')).toBeNull()
  })

  it('เซมเดย์ → ป้าย "⚡ ส่งวันนี้" มุมเดิม', () => {
    renderBadge({ mode: 'SAME_DAY', className: 'absolute top-1 right-1 z-10', testId: 'theater-rec' })
    const el = container.querySelector('[data-testid="theater-rec-sameday"]')
    expect(el?.textContent).toContain('ส่งวันนี้')
  })

  it('ไม่มีโหมด (mode null) → ไม่ป้ายอะไร', () => {
    renderBadge({ mode: null, className: 'x' })
    expect(container.innerHTML).toBe('')
  })
})

describe('R128 — FoodTheater ป้อนข้อมูลจริงให้การ์ด (ของแอดมินก็มีปฏิทิน/ประเภทได้)', () => {
  it('picks mapping สืบทอด available_preorder/available_same_day/is_preorder จากเมนูจริง + _realProduct', () => {
    expect(foodTheaterSrc).toContain('available_preorder: real?.available_preorder')
    expect(foodTheaterSrc).toContain('available_same_day: real?.available_same_day')
    expect(foodTheaterSrc).toContain('is_preorder: real?.is_preorder')
    expect(foodTheaterSrc).toContain('_realProduct: real')
  })

  it('scheduledDate ป้อนจากปฏิทินจริงของเมนูที่ผูก (ตัด hack undefined เดิม)', () => {
    expect(foodTheaterSrc).toContain('schedule[p._realProduct.id]')
    expect(foodTheaterSrc).not.toContain('_theaterItem ? undefined : schedule[p.id]')
  })

  it('การ์ดทั้งสองใช้ ModeCornerBadge มุมเดิม (hero top-2 / rec top-1) + deriveOrderMode', () => {
    expect(theaterCardsSrc).toContain('<ModeCornerBadge mode={mode} scheduledDate={scheduledDate} className="absolute top-2 right-2 z-20" testId="theater-hero" />')
    expect(theaterCardsSrc).toContain('<ModeCornerBadge mode={mode} scheduledDate={scheduledDate} className="absolute top-1 right-1 z-10" testId="theater-rec" />')
    expect(theaterCardsSrc).toContain("import { deriveOrderMode } from '@/lib/talkToBite'")
  })
})