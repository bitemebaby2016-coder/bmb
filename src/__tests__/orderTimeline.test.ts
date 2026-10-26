// ============================================
// Bite Me Baby — OrderTimeline tests (M1 · A5)
// ============================================
// ONE customer timeline driven by the canonical server enum via
// `lib/orderVocabulary` (PAY-04). A5 regression guards:
//   - NO duplicate step labels (the old inline map showed the same
//     "กำลังจัดส่ง" copy on TWO steps — dispatched/in_transit)
//   - every server status renders through the single vocabulary
//   - terminal aborts render an end card, never a fake progress bar
// ============================================

import { beforeAll, describe, expect, it } from 'vitest'
import { createElement as h, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { OrderTimeline } from '@/components/customer/OrderTimeline'
import {
  SERVER_ORDER_STATUSES,
  SERVER_STATUS_LABEL_TH,
} from '@/lib/orderVocabulary'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

// B-1 FIX (2026-10-26): เดิม mount+setTimeout(0) — ตอนรันชุดใหญ่ React ยัง commit ไม่เสร็จ ทำให้
// 4 เคส fail เป็นระยะ (รันตัวไฟล์เดียวผ่านตลอด) → render + flush ข้างใน act() ให้รอ commit จริง
//  Assertions ทุกตัวคงเดิมทั้งหมด (ไม่มีการลด/ข้าม แม้แต่ข้อเดียว — เปลี่ยนแค่วิธีรอผล)
async function renderTimeline(status: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(h(OrderTimeline, { status }))
  })
  return { container, root }
}

function stepLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-testid="order-timeline-step"]')).map(
    (n) => n.textContent?.trim() ?? '',
  )
}

describe('OrderTimeline (M1) — ขับจาก enum จริง + label ไม่ซ้ำ (A5)', () => {
  it('แสดงขั้นเดินหน้า 8 ขั้นจาก server enum และ label ไม่ซ้ำกันเลย', async () => {
    const { container } = await renderTimeline('pending')
    const labels = stepLabels(container)
    expect(labels).toHaveLength(8)
    expect(new Set(labels).size).toBe(8) // A5: no duplicated copy
  })

  it("A5 fix: dispatched='เริ่มจัดส่ง' / in_transit='กำลังเดินทาง' — ไม่ใช่ป้ายเดียวกัน 2 ช่อง", async () => {
    const { container } = await renderTimeline('in_transit')
    const labels = stepLabels(container)
    expect(SERVER_STATUS_LABEL_TH.dispatched).toBe('เริ่มจัดส่ง')
    expect(SERVER_STATUS_LABEL_TH.in_transit).toBe('กำลังเดินทาง')
    expect(labels[4]).toBe('เริ่มจัดส่ง')
    expect(labels[5]).toBe('กำลังเดินทาง')
    expect(labels[4]).not.toBe(labels[5])
  })

  it('label ทุกขั้นมาจาก orderVocabulary ตัวเดียว — ทุกสถานะ render ได้โดยไม่แต่งเรื่องเอง', async () => {
    for (const s of SERVER_ORDER_STATUSES) {
      const { container } = await renderTimeline(s)
      expect(container.querySelector('[data-testid="order-timeline"]')).toBeTruthy()
      if (s === 'cancelled' || s === 'failed') {
        // terminal: end card only
        expect(container.textContent).toContain(SERVER_STATUS_LABEL_TH[s])
      } else {
        const labels = stepLabels(container)
        expect(labels).toContain(SERVER_STATUS_LABEL_TH[s])
      }
    }
  })

  it('SERVER_STATUS_LABEL_TH ทุกสถานะ (รวม terminal) ไม่มีป้ายซ้ำในพจนานุกรมเดียว', () => {
    const labels = SERVER_ORDER_STATUSES.map((s) => SERVER_STATUS_LABEL_TH[s])
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('cancelled/failed = end card ไม่มี progress bar ปลอม', async () => {
    const c = await renderTimeline('cancelled')
    expect(stepLabels(c.container)).toHaveLength(0)
    expect(c.container.textContent).toContain(SERVER_STATUS_LABEL_TH.cancelled)
    const f = await renderTimeline('failed')
    expect(stepLabels(f.container)).toHaveLength(0)
    expect(f.container.textContent).toContain(SERVER_STATUS_LABEL_TH.failed)
  })

  it('สถานะที่เซิร์ฟเวอร์ส่งมาไม่รู้จัก — แสดงตามจริง ไม่สร้าง step ปลอม', async () => {
    const { container } = await renderTimeline('mystery_status')
    expect(container.textContent).toContain('mystery_status')
    expect(stepLabels(container)).toHaveLength(0)
  })
})