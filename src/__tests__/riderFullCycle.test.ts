// ============================================
// Bite Me Baby — R1.4: วงจรไรเดอร์เต็ม (2026-10-23, H-04)
// ============================================
// ปิด "ไรเดอร์รับงานไม่ได้ / งานไม่ต่อ" บนสัญญา migration จริง:
//   dispatch_order (135 §2) → my_deliveries.offers → claim (135 §3 คนแรกจอง)
//   → picked_up → in_transit → delivered (132:540 บังคับ POD) → order sync
//   → heartbeat driver_update_location (136) เขียน driver_location_history
// + race safety: คนที่สอง claim ไม่ได้ (ERR_OFFER_NOT_AVAILABLE) · decline = ต่อคน
//
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import { supabase } from '@/lib/supabase'
import {
  adminCancelOffer,
  assignDriver,
  claimDispatchOffer,
  dispatchOrder,
  driverAttachPod,
  driverDeclineOffer,
  driverUpdateDeliveryStatus,
  driverUpdateLocation,
  getRouteHistory,
  linkDriverUser,
  myDeliveriesResult,
  upsertDriver,
} from '@/lib/driverService'

const ORDER_ROW = {
  id: '', order_number: '', customer_id: 'auth-test-user', customer_ref: 'auth-test-user',
  customer_name: 'T', customer_phone: '0',
  status: 'ready_for_dispatch', payment_status: 'paid', payment_method: 'promptpay_qr',
  total_amount: 10, delivery_fee: 0, delivery_address: 'ทดสอบ', dropoff_latitude: 10, dropoff_longitude: 102,
  delivery_round_id: 'round-1', delivery_method: 'self_delivery',
  items: [] as any[], created_at: '', updated_at: '',
  order_mode: 'SAME_DAY',
}

async function seedOrder(over: Partial<typeof ORDER_ROW> & { order_number: string }) {
  const t = new Date().toISOString()
  await supabase.from('orders').insert([{ ...ORDER_ROW, ...over, created_at: t, updated_at: t, id: over.id || 'o-' + over.order_number }] as any)
}

async function seedLinkedDriver(name: string, phone: string) {
  const drvId = (await upsertDriver(name, phone, 'bike')).driver_id
  await linkDriverUser(drvId as string, 'auth-test-user')
  return drvId as string
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
  ;(supabase as any).__setNoAdmin?.(false)
})

describe('R1.4 · วงจรไรเดอร์เต็มบนสัญญา 135/132/136', () => {
  it('ประกาศ → รับงานคนแรก (จอง) → รับของ → กำลังส่ง → POD → สำเร็จ + order sync', async () => {
    const drvId = await seedLinkedDriver('Paul Rider', '0900000111')
    await seedOrder({ order_number: 'R-FULL', status: 'ready_for_dispatch' })

    // แอดมินส่งออกงาน (ประกาศ + push)
    expect((await dispatchOrder('R-FULL')).ok).toBe(true)

    // ไรเดอร์เห็นงานประกาศใน my_deliveries.offers (ไม่ใช่ assignments)
    const before = await myDeliveriesResult()
    expect(before.ok).toBe(true)
    if (before.ok) {
      expect(before.offers.map((o) => o.order_number)).toContain('R-FULL')
      expect(before.assignments).toHaveLength(0)
    }

    // รับงาน = จองคนเดียว (claim = accept ในตัว)
    expect((await claimDispatchOffer('R-FULL')).ok).toBe(true)
    const asg = (supabase as any).__tables.delivery_assignments as any[]
    expect(asg[0]).toMatchObject({ order_number: 'R-FULL', driver_id: drvId, status: 'accepted' })

    // งานไม่ต่อ = ต้องเดินหน้าได้ทุกขั้นจริง
    expect((await driverUpdateDeliveryStatus('R-FULL', 'picked_up')).ok).toBe(true)
    expect((await driverUpdateDeliveryStatus('R-FULL', 'in_transit')).ok).toBe(true)
    // 132:540 — delivered ต้องมี POD ก่อน
    expect((await driverUpdateDeliveryStatus('R-FULL', 'delivered')).ok).toBe(false)
    expect((await driverAttachPod('R-FULL', `${drvId}/R-FULL.jpg`)).ok).toBe(true)
    expect((await driverUpdateDeliveryStatus('R-FULL', 'delivered')).ok).toBe(true)

    const ord = (supabase as any).__tables.orders as any[]
    expect(ord[0].status).toBe('delivered') // M1-09 sync ตาม canonical spine
    expect(asg[0].proof_of_delivery_path).toBe(`${drvId}/R-FULL.jpg`)

    // หลังส่งสำเร็จ งานไม่อยู่ใน offers แล้ว
    const after = await myDeliveriesResult()
    if (after.ok) expect(after.offers.map((o) => o.order_number)).not.toContain('R-FULL')
  })

  it('race safety: คนแรกจอง คนที่สองรับไม่ได้ (ERR_OFFER_NOT_AVAILABLE)', async () => {
    await seedLinkedDriver('First Rider', '0900000112')
    await seedOrder({ order_number: 'R-RACE', status: 'ready_for_dispatch' })
    await dispatchOrder('R-RACE')
    expect((await claimDispatchOffer('R-RACE')).ok).toBe(true)
    // claim ซ้ำ (คนที่สอง หรือคนเดิมกดซ้ำ) ต้องพลาด — offer ถูกจองไปแล้ว
    const again = await claimDispatchOffer('R-RACE')
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.kind).toBe('state') // ERR_OFFER_NOT_AVAILABLE → state
  })
})

describe('R1.4 · decline/cancel/assign-ชนะ/GPS (135 §4-7 + 136)', () => {
  it('decline offer = ต่อคนเท่านั้น — ฉันไม่เห็นงานนั้นอีก คนอื่นยังรับได้', async () => {
    await seedLinkedDriver('Decliner', '0900000113')
    await seedOrder({ order_number: 'R-DEC', status: 'ready_for_dispatch' })
    await dispatchOrder('R-DEC')
    expect((await driverDeclineOffer('R-DEC')).ok).toBe(true)
    const me = await myDeliveriesResult()
    if (me.ok) expect(me.offers.map((o) => o.order_number)).not.toContain('R-DEC')
    // offer ยัง 'offered' — คนแรกที่กดรับยังได้งาน (decline ไม่ปิดประกาศ)
    expect((await claimDispatchOffer('R-DEC')).ok).toBe(true)
  })

  it('แอดมินยกเลิกประกาศ → รับไม่ได้ (ERR_OFFER_NOT_AVAILABLE)', async () => {
    await seedLinkedDriver('Late Rider', '0900000114')
    await seedOrder({ order_number: 'R-CXL', status: 'ready_for_dispatch' })
    await dispatchOrder('R-CXL')
    expect((await adminCancelOffer('R-CXL', 'ปิดรอบ')).ok).toBe(true)
    const r = await claimDispatchOffer('R-CXL')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.kind).toBe('state') // ERR_OFFER_NOT_AVAILABLE → state
  })

  it('assign ตรงระหว่างประกาศ = ชนะประกาศ (135 §7) — claim หลัง assign ไม่ได้', async () => {
    const drvId = await seedLinkedDriver('Direct Rider', '0900000115')
    await seedOrder({ order_number: 'R-DIR', status: 'ready_for_dispatch' })
    await dispatchOrder('R-DIR')
    expect(await assignDriver('R-DIR', drvId)).toBe(true) // เลือกไรเดอร์ก่อน → ชนะ offer
    const r = await claimDispatchOffer('R-DIR')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.kind).toBe('state') // ERR_OFFER_NOT_AVAILABLE → state
    const asg = (supabase as any).__tables.delivery_assignments as any[]
    expect(asg[0].driver_id).toBe(drvId)
    expect(asg[0].status).toBe('assigned')
  })

  it('heartbeat (136): driver_update_location เขียน driver_location_history + อ่านเส้นทางย้อนหลังได้', async () => {
    const drvId = await seedLinkedDriver('Gps Rider', '0900000116')
    await seedOrder({ order_number: 'R-GPS', status: 'ready_for_dispatch' })
    await assignDriver('R-GPS', drvId)
    expect(await driverUpdateLocation({ latitude: 13.7563, longitude: 100.5018 }, 'R-GPS')).toMatchObject({ ok: true })
    expect(await driverUpdateLocation({ latitude: 13.7600, longitude: 100.5100 }, 'R-GPS')).toMatchObject({ ok: true })
    const route = await getRouteHistory('R-GPS')
    expect(route).toHaveLength(2)
    expect(route[0]).toMatchObject({ latitude: 13.7563, longitude: 100.5018 })
    expect(route[1].recorded_at >= route[0].recorded_at).toBe(true)
    // driver ไม่ผูกบัญชี = heartbeat ไม่ได้ (identity = JWT เท่านั้น)
    ;(supabase as any).__tables.drivers.forEach((d: any) => { d.user_id = 'someone-else' })
    const noAuth = await driverUpdateLocation({ latitude: 1, longitude: 1 }, 'R-GPS')
    expect(noAuth.ok).toBe(false)
    if (!noAuth.ok) expect(noAuth.kind).toBe('permission') // ERR_NOT_A_DRIVER → permission
  })
})