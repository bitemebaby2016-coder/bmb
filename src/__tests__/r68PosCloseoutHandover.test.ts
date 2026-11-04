// ============================================
// Bite Me Baby — R68: test coverage ของ pos_closeout_order / handleHandover (เดิม = 0)
// + R66-D (ปิดกะตามเวลาจริง · dynamic links ทุกปุ่ม POS) + console noise 3 ตัว
// Owner: 2026-11-04 · scope = CLOSURE_REPORT §5.2 ข้อ 3 + ข้อ 2 + ข้อ 5
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { rpcMock, fromMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), fromMock: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpcMock(...a),
    from: (...a: unknown[]) => fromMock(...a),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-r68' } } } }) },
  },
  supabaseAdmin: null,
  getCurrentUser: async () => null,
  isAdmin: async () => false,
  default: null,
}))

import { posCloseoutOrder, getShiftCashSummary } from '@/lib/posApi'
import { driverLogin } from '@/lib/driverService'
import { getPublishedScheduleForDate } from '@/lib/bmbMenuSchedule'
import { getActiveRoundsForDate, ensureRoundsForDate } from '@/lib/bmbAdminApi_rounds'
import adminPosSrc from '@/pages/admin/AdminPos.tsx?raw'
import adminOrdersSrc from '@/pages/admin/AdminOrders.tsx?raw'
import cartSyncSrc from '@/lib/cartSessionSync.ts?raw'
import mig129 from '../../supabase/migrations/129_pos_staff_shift.sql?raw'

/** chain stub ที่ then-able ได้เหมือน postgrest builder (คืนผลที่กำหนด) */
function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'maybeSingle']) {
    c[m] = vi.fn(() => c)
  }
  c.then = (onOk: unknown, onErr: unknown) => Promise.resolve(result).then(onOk as never, onErr as never)
  return c
}

beforeEach(() => {
  rpcMock.mockReset()
  fromMock.mockReset()
})

// ---------------------------------------------------------------------------
// 1) pos_closeout_order — ฝั่ง client (src/lib/posApi.ts)
// ---------------------------------------------------------------------------
describe('R68 · pos_closeout_order — client wrapper', () => {
  it('เรียก rpc ชื่อ/พารามิเตอร์ถูกต้อง และคืน status ของ server', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ok: true, status: 'delivered' }, error: null })
    const r = await posCloseoutOrder('BMB-20261104-365', true)
    expect(rpcMock).toHaveBeenCalledWith('pos_closeout_order', {
      p_order_number: 'BMB-20261104-365',
      p_mark_paid: true,
    })
    expect(r).toEqual({ ok: true, status: 'delivered' })
  })

  it('p_mark_paid=false ส่งตามที่ caller สั่ง (ไม่บังคับจ่ายเงินฝั่ง client)', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ok: true, status: 'preparing' }, error: null })
    await posCloseoutOrder('BMB-X', false)
    expect(rpcMock).toHaveBeenCalledWith('pos_closeout_order', {
      p_order_number: 'BMB-X',
      p_mark_paid: false,
    })
  })

  it('server คืน error → { ok:false, error } (ไม่โยนทิ้ง ไม่เงียบ)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'ERR_ORDER_NOT_FOUND' } })
    const r = await posCloseoutOrder('BMB-NOPE', true)
    expect(r).toEqual({ ok: false, error: 'ERR_ORDER_NOT_FOUND' })
  })
})

// ---------------------------------------------------------------------------
// 2) pos_closeout_order — สัญญา server (migration 129 ตัวจริง)
// ---------------------------------------------------------------------------
describe('R68 · pos_closeout_order — SQL contract (129_pos_staff_shift.sql)', () => {
  const fn = mig129.slice(mig129.indexOf('public.pos_closeout_order('))

  it('เดินเฉพาะเส้นทางที่อนุญาต: pending→confirmed→preparing→ready_for_dispatch→delivered', () => {
    const seq = ["'confirmed'", "'preparing'", "'ready_for_dispatch'", "'delivered'"]
    let at = -1
    for (const step of seq) {
      const i = fn.indexOf(step, at + 1)
      expect(i, 'ขาดขั้น ' + step).toBeGreaterThan(at)
      at = i
    }
    expect(fn).toContain('public.transition_order_status')
    expect(fn.match(/transition_order_status\(p_order_number/g)!.length).toBe(4)
  })

  it('ยืนยันชำระเงินเฉพาะเมื่อ p_mark_paid AND ถึง delivered เท่านั้น', () => {
    expect(fn).toContain("IF p_mark_paid AND v_status = 'delivered' THEN")
    expect(fn).toContain('public.confirm_offline_payment(p_order_number)')
    expect(fn.indexOf('confirm_offline_payment')).toBeGreaterThan(fn.indexOf("'delivered'"))
  })

  it('gate สิทธิ์ is_admin/is_staff + REVOKE anon/PUBLIC + GRANT authenticated', () => {
    expect(fn).toContain("IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'")
    expect(mig129).toContain('REVOKE EXECUTE ON FUNCTION public.pos_closeout_order FROM PUBLIC, anon')
    expect(mig129).toContain('GRANT EXECUTE ON FUNCTION public.pos_closeout_order TO authenticated')
  })

  it('close_shift ใช้หน้าต่างเวลา "จริง" ของกะ (updated_at >= opened_at) + เงินสดที่ชำระแล้วเท่านั้น', () => {
    expect(mig129).toContain('o.updated_at >= v_row.opened_at')
    expect(mig129).toContain("o.payment_status = 'paid'")
    expect(mig129).toContain('order totals of unpaid orders are never treated as cash received')
  })
})

// ---------------------------------------------------------------------------
// 4) handleHandover — ปุ่ม "ส่งมอบ (ตรวจรหัส)" ที่ Web POS
// ---------------------------------------------------------------------------
describe('R68 · handleHandover (AdminPos) — ตรวจรหัส 6 หลักก่อนปิดวงจร', () => {
  it('เปิด prompt รหัส 6 หลักของออเดอร์นั้น', () => {
    expect(adminPosSrc).toContain('async function handleHandover(o: OrderForm)')
    expect(adminPosSrc).toMatch(/window\.prompt\([\s\S]{0,120}6 หลัก/)
    expect(adminPosSrc).toContain("code.trim() !== String(o.pickup_code ?? '')")
  })

  it('รหัสผิด = toast + return "ก่อน" ถึง posCloseoutOrder (ปิดวงจรไม่ได้โดยบังเอิญ)', () => {
    const bad = adminPosSrc.indexOf("code.trim() !== String(o.pickup_code ?? '')")
    const close = adminPosSrc.indexOf('posCloseoutOrder(o.order_number, true)')
    const abort = adminPosSrc.indexOf('ยกเลิกการส่งมอบ', bad)
    expect(bad).toBeGreaterThan(-1)
    expect(abort).toBeGreaterThan(bad)
    expect(abort).toBeLessThan(close)
    expect(adminPosSrc.slice(bad, close)).toContain('return')
  })

  it('รหัสถูก = posCloseoutOrder(order, mark_paid=true) + toast สำเร็จ + รีเฟรชยอดกะ', () => {
    const close = adminPosSrc.indexOf('posCloseoutOrder(o.order_number, true)')
    const tail = adminPosSrc.slice(close, close + 340)
    expect(tail).toContain('ส่งมอบออเดอร์')
    expect(tail).toContain('await refresh()')
    expect(tail).toContain('reloadCashSummary')
  })
})

// ---------------------------------------------------------------------------
// 5) R66-D ① — ปิดกะตามเวลาจริง (นาฬิกา · เตือนเลยเวลาเปิดร้าน · ยอดสด)
// ---------------------------------------------------------------------------
describe('R66-D · ปิดกะตามเวลาจริง (Web POS)', () => {
  it('นาฬิกากะเดินจริง 1 วิ + แสดงเวลา/ความยาวกะจากเวลาเปิดกะจริง', () => {
    expect(adminPosSrc).toContain('setInterval(() => setNowMs(Date.now()), 1000)')
    expect(adminPosSrc).toContain('data-testid="pos-live-clock"')
    expect(adminPosSrc).toContain('elapsedText(shift.opened_at, nowMs)')
    expect(adminPosSrc).toContain('data-testid="pos-shift-elapsed"')
  })

  it('เช็กเวลาเปิดปิดร้านจริงจาก business_settings (withinShopHours + BKK ms-of-day) — ห้ามเดา', () => {
    expect(adminPosSrc).toContain('withinShopHours(bkkMsOfDay(new Date(nowMs)), shopCfg.shopHoursMs)')
    expect(adminPosSrc).toContain('ensureShopConfigLoaded()')
    // ค่ายังไม่โหลด (null) → ไม่ตัดสินว่าปิด (ZERO-FAKE)
    expect(adminPosSrc).toMatch(/shopCfg\?\.shopHoursMs\s*\n\s*\? !withinShopHours/)
  })

  it('เลยเวลาปิดร้าน = ป้ายเตือน + ถามยืนยันก่อนขาย "ก่อน" ถึง setBusy', () => {
    expect(adminPosSrc).toContain('data-testid="pos-after-hours-banner"')
    const guard = adminPosSrc.indexOf('if (pastHours) {')
    const busy = adminPosSrc.indexOf('setBusy(true)')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(busy)
    expect(adminPosSrc.slice(guard, busy)).toContain('window.confirm(')
  })

  it('ยอดเงินสดระหว่างกะ = ดึงจาก window เดียวกับ close_shift · ดึงไม่ได้ = บอกว่าดึงไม่ได้ (ห้าม 0 ปลอม)', async () => {
    const c = chain({ data: [{ total_amount: 100 }, { total_amount: 50.5 }], error: null })
    fromMock.mockReturnValueOnce(c)
    const ok = await getShiftCashSummary('2026-11-04T03:00:00Z')
    expect(fromMock).toHaveBeenCalledWith('orders')
    expect(ok).toEqual({ ok: true, orderCount: 2, cashTotal: 150.5 })
    const c2 = chain({ data: null, error: { message: 'permission denied' } })
    fromMock.mockReturnValueOnce(c2)
    const bad = await getShiftCashSummary('2026-11-04T03:00:00Z')
    expect(bad.ok).toBe(false)
    expect(bad.cashTotal).toBe(0)
    expect(bad.error).toBe('permission denied')
    expect(adminPosSrc).toContain("ค่าจริงเท่านั้น")
    expect(adminPosSrc).toContain("ดึงยอดเงินสดไม่ได้")
  })

  it('ปิดกะสำเร็จ/ขายเงินสดสำเร็จ → รีเฟรชยอดระหว่างกะทันที', () => {
    expect(adminPosSrc).toContain('void reloadCashSummary(shift?.opened_at)')
  })
})

// ---------------------------------------------------------------------------
// 6) R66-D ② — dynamic links ทุกปุ่ม POS (ไม่ hardcode · role-filter · หน้าจริง)
// ---------------------------------------------------------------------------
describe('R66-D · dynamic links ของ Web POS', () => {
  it('ทางลัดทุกปุ่มมาจาก nav ชุดเดิมของระบบ + กรองตามสิทธิ์ role (ไม่สร้างเมนูใหม่)', () => {
    expect(adminPosSrc).toContain('data-testid="pos-quick-links"')
    expect(adminPosSrc).toContain('ADMIN_NAV_ITEMS.filter((i) => wanted.includes(i.to) && allowed.has(i.to))')
    expect(adminPosSrc).toContain('navGroupsForRole(role)')
    expect(adminPosSrc).toContain('const allowed = new Set(')
  })

  it('ทุกปุ่มชี้ไปหน้าจริง: /admin · /admin/orders · /admin/customers · /admin/reports · เปิดตามสถานะ', () => {
    expect(adminPosSrc).toContain('to={l.to}')
    expect(adminPosSrc).toContain('to="/admin/reports"')
    expect(adminPosSrc).toContain('data-testid="pos-link-last-order"')
    expect(adminPosSrc).toContain('/admin/orders?status=${encodeURIComponent(o.status)}')
    // ปลายทาง ?status= ถูก preset จริงในหน้าออเดอร์
    expect(adminOrdersSrc).toContain("searchParams.get('status')")
    expect(adminOrdersSrc).toContain('STATUS_FILTERS.some((f) => f.key === s)')
  })
})

// ---------------------------------------------------------------------------
// 7) console noise 3 ตัว (CLOSURE_REPORT §5.1) — ปิดที่ต้นทาง ไม่ใช่ปิด assertion
// ---------------------------------------------------------------------------
describe('R68 · console noise #1 — driver_login ERR_NOT_A_DRIVER', () => {
  it('บัญชีที่ไม่ใช่ไรเดอร์ = เงียบ (ไม่ warn) · error อื่นยัง warn ตามเดิม', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'ERR_NOT_A_DRIVER: no driver record is linked' } })
    expect(await driverLogin()).toBeNull()
    expect(warn).not.toHaveBeenCalled()
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'connection reset' } })
    expect(await driverLogin()).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

})

describe('R68 · console noise #2 — cart_sessions RLS 42501', () => {
  it('session id = key ต่อผู้ใช้ (อีกบัญชีใช้เครื่องเดียวกันไม่ upsert ทับกัน)', () => {
    expect(cartSyncSrc).toContain("const key = SESSION_KEY + ':' + uid")
    expect(cartSyncSrc).toContain('function sessionId(uid: string)')
    expect(cartSyncSrc).toContain('id: sessionId(uid),')
    // ลำดับเดิมของ R63 ต้องคงอยู่: guest guard อยู่ก่อน upsert
    expect(cartSyncSrc).toContain('if (!uid) return')
    expect(cartSyncSrc.indexOf('if (!uid) return')).toBeLessThan(cartSyncSrc.indexOf('.upsert('))
    expect(cartSyncSrc).toContain("{ onConflict: 'id' }")
    expect(cartSyncSrc).toContain('r63Cart401Probe')
    // error = เงียบ (telemetry ห้ามเป็น console noise)
    expect(cartSyncSrc).toContain('if (res?.error) return')
  })
})

describe('R68 · console noise #3 — query date "" (22007)', () => {
  it('getPublishedScheduleForDate("") = ไม่ยิง server (คืน [])', async () => {
    expect(await getPublishedScheduleForDate('')).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('getActiveRoundsForDate("") = ไม่ยิง server (คืน [])', async () => {
    expect(await getActiveRoundsForDate('')).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('ensureRoundsForDate("") = ไม่ยิง ensure_rounds_for_date (คืน false)', async () => {
    expect(await ensureRoundsForDate('')).toBe(false)
    const names = rpcMock.mock.calls.map((c) => c[0])
    expect(names).not.toContain('ensure_rounds_for_date')
  })
})
