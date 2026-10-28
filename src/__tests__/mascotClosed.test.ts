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
import { getStoreStatusFromRounds } from '@/lib/homeProviders'
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

describe('storeStatus — ตรรกะเปิด/ปิดร้านจากรอบส่งจริง (ZERO-FAKE 2026-10-18)', () => {
  beforeEach(() => { publishDeliveryRounds(null) })

  it('ยังไม่มีข้อมูลรอบส่ง → ยังไม่ยืนยันว่าเปิด (ไม่เดาจากเวลา) ทุกช่วงเวลา', () => {
    for (const t of ['2026-10-14T13:30:00Z', '2026-10-14T00:00:00Z', '2026-10-14T03:00:00Z']) {
      const s = currentStoreStatus(new Date(t))
      expect(s.isOpen, t).toBe(false)
      expect(s.message, t).toContain('ยังไม่มีข้อมูลรอบจัดส่ง')
    }
    expect(isStoreClosedNow(new Date('2026-10-14T00:00:00Z'))).toBe(true)
  })

  it("status='active' (ค่าจริงในฐานข้อมูล) + ยังไม่เลย cutoff → เปิดรับ", () => {
    publishDeliveryRounds([
      { status: 'active', display_name: 'รอบเช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 10, current_count: 2, scheduled_date: '2026-10-14' },
    ] as never)
    // 07:00 ICT = 2026-10-14T00:00:00Z — อยู่ในหน้าต่าง 06:00-09:00 และก่อน cutoff 08:00
    expect(isStoreClosedNow(new Date('2026-10-14T00:00:00Z'))).toBe(false)
  })

  it('legacy status="open" ก็ยังใช้ได้ (compat)', () => {
    publishDeliveryRounds([
      { status: 'open', display_name: 'รอบเย็น', cutoff_time: '23:59', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 10, current_count: 0, scheduled_date: '2026-10-14' },
    ] as never)
    // 18:00 ICT = 2026-10-14T11:00:00Z — อยู่ในหน้าต่าง 17:00-20:00
    expect(isStoreClosedNow(new Date('2026-10-14T11:00:00Z'))).toBe(false)
  })

  it('ทุกรอบปิด/ไม่มีรอบเปิด → ร้านปิดตามข้อมูลจริง (ไม่ fallback ไปตรรกะเวลาปลอม)', () => {
    publishDeliveryRounds([
      { status: 'closed', display_name: 'รอบเช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 10, current_count: 10 },
    ] as never)
    const s = currentStoreStatus(new Date('2026-10-14T03:00:00Z')) // 10:00 ICT
    expect(s.isOpen).toBe(false)
    expect(s.message).toContain('ไม่มีรอบจัดส่งที่เปิดรับ')
  })

  it('รอบวันนี้ window ผ่านแล้ว — SAME_DAY ไม่มีปิดรอบ (Owner Q1 2026-10-24) → ยังเปิดทั้งวัน', () => {
    publishDeliveryRounds([
      { status: 'active', display_name: 'รอบเช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 10, current_count: 1, scheduled_date: '2026-10-14' },
      { status: 'active', display_name: 'พรุ่งนี้เช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 10, current_count: 0, scheduled_date: '2026-10-15' },
    ] as never)
    // 10:00 ICT — รอบเช้าหน้าต่าง 06-09 ผ่านแล้ว แต่ Q1: เซมเดย์ไม่มีปิดรอบ/window ปิด
    const s = currentStoreStatus(new Date('2026-10-14T03:00:00Z'))
    expect(s.isOpen).toBe(true)
    expect(s.state).toBe('open')
  })

  it('แอดมินปิดรอบวันนี้แล้ว + มีรอบอนาคต → เปิดเฉพาะจองล่วงหน้า (preorder_only)', () => {
    publishDeliveryRounds([
      { status: 'closed', display_name: 'รอบเช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 10, current_count: 1, scheduled_date: '2026-10-14' },
      { status: 'active', display_name: 'พรุ่งนี้เช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 10, current_count: 0, scheduled_date: '2026-10-15' },
    ] as never)
    const s = currentStoreStatus(new Date('2026-10-14T03:00:00Z')) // 10:00 ICT
    expect(s.isOpen).toBe(true)
    expect(s.state).toBe('preorder_only')
    expect(s.message).toContain('จองล่วงหน้า')
  })

  it('เต็มทุกรอบวันนี้ = ปิดรับ (capacity gate ตามข้อมูลจริง)', () => {
    publishDeliveryRounds([
      { status: 'active', display_name: 'รอบเที่ยง', cutoff_time: '23:59', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 10, current_count: 10, scheduled_date: '2026-10-14' },
    ] as never)
    // 11:00 ICT = 2026-10-14T04:00:00Z — เต็ม 10/10
    expect(currentStoreStatus(new Date('2026-10-14T04:00:00Z')).isOpen).toBe(false)
  })

  it('getStoreStatusFromRounds([]) → ไม่มี fallback ข้อมูลปลอม (ไม่มีป้ายเวลา/ความจุแต่งเอง)', () => {
    const s = getStoreStatusFromRounds([], new Date('2026-10-14T00:00:00Z'))
    expect(s.isOpen).toBe(false)
    expect(s.capacityPct).toBeUndefined()
    expect(s.currentRoundLabel).toBeUndefined()
    expect(s.deliveryWindowLabel).toBeUndefined()
    expect(s.message).toContain('ไม่มีรอบจัดส่งที่เปิดรับ')
  })

  it('สองเลน (Owner 2026-10-25): ปิดรอบพรีออเดอร์วันนี้ผ่านแล้ว → preOrderLine ชี้รอบอนาคต + เซมเดย์ยังเปิด', () => {
    publishDeliveryRounds([
      { status: 'active', display_name: 'รอบเที่ยง', cutoff_time: '10:30', pre_order_cutoff: '09:00', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 50, current_count: 1, scheduled_date: '2026-10-14' },
      { status: 'active', display_name: 'พรุ่งนี้เที่ยง', cutoff_time: '10:30', pre_order_cutoff: '09:00', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 50, current_count: 0, scheduled_date: '2026-10-15' },
    ] as never)
    // 14:36 ICT = 07:36Z — เลยปิดรอบ 09:00 ของวันนี้แล้ว → รอบที่สั่งได้ = พรุ่งนี้ (อนาคต)
    const s = currentStoreStatus(new Date('2026-10-14T07:36:00Z'))
    expect(s.isOpen).toBe(true) // เซมเดย์สั่งได้ตลอด (Q1/148)
    expect(s.state).toBe('open')
    expect(s.preOrderLine).toContain('พรุ่งนี้เที่ยง')
    expect(s.preOrderLine).toContain('ปิดรอบ 09:00')
  })

  it('สองเลน: ทุกรอบวันนี้เลยปิดรอบ + ไม่มีรอบอนาคต → preOrderLine = ปิดรับแล้ว (ร้านยังเปิดรับเซมเดย์)', () => {
    publishDeliveryRounds([
      { status: 'active', display_name: 'รอบเย็น', cutoff_time: '16:00', pre_order_cutoff: '15:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 50, current_count: 0, scheduled_date: '2026-10-14' },
    ] as never)
    // 16:00 ICT = 09:00Z — เลย pre_order_cutoff 15:00 แล้ว · ไม่มีรอบอนาคต
    const s = currentStoreStatus(new Date('2026-10-14T09:00:00Z'))
    expect(s.preOrderLine).toContain('ปิดรับแล้ว')
    expect(s.isOpen).toBe(true)
    expect(s.state).toBe('open')
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