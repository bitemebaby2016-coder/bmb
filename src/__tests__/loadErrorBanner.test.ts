// ============================================
// BMB — LoadErrorBanner tests (R21 · Phase 3 UI/UX edge cases)
// ============================================
// ปัญหาที่ป้องกัน: โหลดล้มเหลวแล้วหน้า "เงียบ" → ผู้ใช้เข้าใจผิดว่า "ไม่มีข้อมูล"
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

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

function render(props: Partial<React.ComponentProps<typeof LoadErrorBanner>> = {}) {
  act(() => {
    root.render(
      React.createElement(LoadErrorBanner, {
        message: 'โหลดเมนูไม่สำเร็จ — กด "ลองใหม่"',
        onRetry: () => {},
        ...props,
      }),
    )
  })
}

describe('LoadErrorBanner — โหลดไม่สำเร็จต้องฟ้อง + ลองใหม่ได้', () => {
  it('แสดงข้อความ + role=alert + ปุ่มลองใหม่', () => {
    render()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('โหลดเมนูไม่สำเร็จ')
    expect(container.querySelector('[data-testid="load-error-retry"]')).toBeTruthy()
  })

  it('กด "ลองใหม่" เรียก onRetry ครั้งเดียวต่อหนึ่งคลิก (ไม่ยิงซ้ำเอง)', () => {
    const onRetry = vi.fn()
    render({ onRetry })
    const btn = container.querySelector('[data-testid="load-error-retry"]') as HTMLButtonElement
    act(() => { btn.click() })
    act(() => { btn.click() })
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('data-testid ของ banner/ปุ่ม คงไว้ให้ test หน้าอื่นอ้างอิง', () => {
    render({ testId: 'menu-load-error' })
    expect(container.querySelector('[data-testid="menu-load-error"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="menu-load-error-retry"]')).toBeTruthy()
  })

  it('ปุ่มรอง (secondaryAction) แสดงเมื่อส่งมา', () => {
    render({ secondaryAction: React.createElement('a', { href: '/menu' }, 'ไปหน้าเมนู') })
    expect(container.querySelector('a[href="/menu"]')?.textContent).toBe('ไปหน้าเมนู')
  })

  it('ข้อความว่างเปล่าไม่พัง (system ไม่ throw)', () => {
    render({ message: '' })
    expect(container.querySelector('[role="alert"]')).toBeTruthy()
  })
})
