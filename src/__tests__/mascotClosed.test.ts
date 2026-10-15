// ============================================
// Bite Me Baby — mascot closed-store pose tests (UX 2026-10-14)
// กติกา: นอกเวลาทำการ/ร้านปิด → ทุกท่าต้องถูกบังคับเข้าชุด
//   bite_closed / bite_empty_sad / bite_sad — ครบทุกท่าทุกเซกชัน
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CLOSED_STORE_POSES,
  CLOSED_FLOATING_POSES,
  enforceClosedPose,
  enforceClosedFloatingPose,
  floatingPosePool,
} from '@/lib/mascotClosed'
import { isStoreClosedNow, publishDeliveryRounds, currentStoreStatus } from '@/lib/storeStatus'
import type { MascotPose } from '@/types'

// ชุดท่าทั้งหมดที่ระบบประกาศไว้ (ต้องครบ 23 ท่า — เทียบกับ types/index.ts)
const ALL_POSES: MascotPose[] = [
  'greeting', 'heart', 'thumbsup', 'running', 'pointing', 'peeking', 'thinking',
  'empty', 'bye', 'award', 'cooking', 'eating', 'feedback', 'menu', 'ready',
  'recommend', 'reviewing', 'shopping', 'success', 'vote', 'waiting', 'sad', 'closed',
]

describe('mascotClosed — บังคับท่าตอนร้านปิด (ครบทุกท่า)', () => {
  it('ทุกท่าเมื่อร้านปิด → อยู่ในชุด closed/empty/sad เท่านั้น', () => {
    for (const pose of ALL_POSES) {
      const out = enforceClosedPose(pose, true)
      expect(CLOSED_STORE_POSES as readonly string[], `ท่า ${pose} ไม่อยู่ในชุดร้านปิด`).toContain(out)
    }
  })

  it('ร้านเปิด → คืนท่าเดิมไม่แตะอะไรเลย', () => {
    for (const pose of ALL_POSES) {
      expect(enforceClosedPose(pose, false)).toBe(pose)
    }
  })

  it('แผนผังตามที่ตกลง: empty/waiting/thinking→empty · sad/bye/feedback→sad · อื่น→closed', () => {
    expect(enforceClosedPose('empty', true)).toBe('empty')
    expect(enforceClosedPose('waiting', true)).toBe('empty')
    expect(enforceClosedPose('thinking', true)).toBe('empty')
    expect(enforceClosedPose('sad', true)).toBe('sad')
    expect(enforceClosedPose('bye', true)).toBe('sad')
    expect(enforceClosedPose('feedback', true)).toBe('sad')
    expect(enforceClosedPose('greeting', true)).toBe('closed')
    expect(enforceClosedPose('cooking', true)).toBe('closed')
    expect(enforceClosedPose('success', true)).toBe('closed')
    expect(enforceClosedPose('closed', true)).toBe('closed')
  })
})

describe('mascotClosed — ตัวลอย (BiteMascot) หมุนวนเฉพาะ 3 ท่า', () => {
  it('ชุดท่าเมื่อร้านปิด = bite_closed/bite_empty_sad/bite_sad', () => {
    expect([...CLOSED_FLOATING_POSES]).toEqual(['bite_closed', 'bite_empty_sad', 'bite_sad'])
  })

  it('ร้านปิด → ท่าใดก็ตามถูกแทนด้วยชุด 3 ท่า', () => {
    for (const p of ['bite_ready', 'bite_menu', 'bite_success', 'bite_goodbye', 'bite_closed']) {
      const out = enforceClosedFloatingPose(p, true)
      expect(CLOSED_FLOATING_POSES as readonly string[]).toContain(out)
    }
    // ท่าที่อยู่ในชุดอยู่แล้วไม่ถูกเปลี่ยน
    expect(enforceClosedFloatingPose('bite_sad', true)).toBe('bite_sad')
    expect(enforceClosedFloatingPose('bite_empty_sad', true)).toBe('bite_empty_sad')
  })

  it('ร้านเปิด → ท่าเดิมไม่ถูกแตะ + pool คืนชุดปกติ', () => {
    expect(enforceClosedFloatingPose('bite_ready', false)).toBe('bite_ready')
    const normal = ['bite_ready', 'bite_menu'] as const
    expect(floatingPosePool(false, normal)).toBe(normal)
    expect([...floatingPosePool(true, normal)]).toEqual([...CLOSED_FLOATING_POSES])
  })
})

describe('storeStatus — ตรรกะเปิด/ปิดร้าน (เดียวกับแถบหน้าแรก)', () => {
  beforeEach(() => { publishDeliveryRounds(null) })
  afterEach(() => { vi.useRealTimers() })

  it('นอกเวลาทำการ (20:30) → ร้านปิด · ในเวลาทำการ (07:00) → ร้านเปิด', () => {
    expect(isStoreClosedNow(new Date('2026-10-14T20:30:00'))).toBe(true)
    expect(isStoreClosedNow(new Date('2026-10-14T07:00:00'))).toBe(false)
  })

  it('ช่วงพักรอบ (10:00) ยังนับว่าร้านเปิด (same_day_closed ไม่ใช่ร้านปิด)', () => {
    expect(isStoreClosedNow(new Date('2026-10-14T10:00:00'))).toBe(false)
  })

  it('มีรอบส่งจริง → ใช้สถานะจากรอบส่ง (ปิดทุกรอบ = ร้านปิด)', () => {
    publishDeliveryRounds([
      { status: 'closed', display_name: 'รอบเช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 10, current_count: 10 },
    ] as never)
    // ทุกรอบปิด → fallback ไปตรรกะเวลา (10:00 = same_day_closed = เปิดอยู่)
    expect(currentStoreStatus(new Date('2026-10-14T10:00:00')).isOpen).toBe(true)

    publishDeliveryRounds([
      { status: 'open', display_name: 'รอบเย็น', cutoff_time: '16:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 10, current_count: 0 },
    ] as never)
    // มีรอบเปิด → ร้านเปิดแม้เลยเวลาทำการ
    expect(isStoreClosedNow(new Date('2026-10-14T21:00:00'))).toBe(false)
  })
})

describe('MascotBadge — แสดงรูปท่าร้านปิดจริง (render test)', () => {
  afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); document.body.innerHTML = '' })

  async function renderBadge(pose: MascotPose, storeClosed: boolean): Promise<HTMLImageElement> {
    vi.resetModules()
    vi.doMock('@/lib/storeStatus', () => ({ useStoreClosed: () => storeClosed }))
    vi.doMock('@/lib/mascotService', () => ({
      loadMascotOverrides: async () => [],
      getOverrideUrl: () => undefined,
    }))
    const { MascotBadge } = await import('@/components/MascotBadge')
    const { createRoot } = await import('react-dom/client')
    const { createElement, act } = await import('react')
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(createElement(MascotBadge, { pose, size: 'sm', alt: 'test', className: '', loading: 'eager' }))
    })
    return host.querySelector('img') as HTMLImageElement
  }

  it('ร้านปิด → ทุกท่าแสดงรูปในชุด closed/empty/sad เท่านั้น', async () => {
    for (const pose of ALL_POSES) {
      const img = await renderBadge(pose, true)
      const src = img.getAttribute('src') || ''
      const ok = src.includes('bite_closed') || src.includes('bite_empty_sad') || src.includes('bite_sad')
      expect(ok, `pose=${pose} ยังโชว์รูปนอกชุดร้านปิด: ${src}`).toBe(true)
    }
  })

  it('ร้านเปิด → แสดงรูปท่าเดิมตามปกติ', async () => {
    const img = await renderBadge('cooking', false)
    expect(img.getAttribute('src')).toContain('bite_cooking')
    const img2 = await renderBadge('greeting', false)
    expect(img2.getAttribute('src')).toContain('bite_hero_greeting')
  })
})