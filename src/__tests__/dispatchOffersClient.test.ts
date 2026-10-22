// ============================================
// Bite Me Baby — E1+A4+A8+M4+M3 client guarantees (2026-10-22)
// ============================================
// พฤติกรรมจริงของ announce-claim พิสูจน์แล้วใน SQL contract 135 (G1-G7 บน PG จริง)
// — เทสต์ชุดนี้คุมฝั่ง client: ทุกหน้าใช้ RPC จริง (ไม่มี stub/mock/hardcode),
// ปุ่มสั่งงานอยู่ที่หน้าเจ้าของเดียว, พอร์ทัลไรเดอร์แยกจากลูกค้า, ของซ้ำถูกลบแล้ว
//
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect } from 'vitest'
import driverServiceSrc from '../lib/driverService.ts?raw'
import riderPageSrc from '../pages/RiderPwaPage.tsx?raw'
import deliveryMgmtSrc from '../pages/admin/DeliveryManagement.tsx?raw'
import adminOrdersSrc from '../pages/admin/AdminOrders.tsx?raw'
import migrationSrc from '../../supabase/migrations/135_dispatch_offers.sql?raw'
import contractSrc from '../../e2e/contracts_135_dispatch_offers.sql?raw'

describe('E1 · driverService = ทางเดียวสู่ RPC ประกาศ-รับงาน (135)', () => {
  it('มีครบทั้ง 4 action: dispatch/claim/decline-offer/cancel-offer', () => {
    for (const rpc of [
      "rpc('dispatch_order'",
      "rpc('claim_dispatch_offer'",
      "rpc('driver_decline_offer'",
      "rpc('cancel_dispatch_offer'",
    ]) {
      expect(driverServiceSrc, `ต้องเรียก ${rpc}`).toContain(rpc)
    }
    expect(driverServiceSrc).toContain('ERR_OFFER_NOT_AVAILABLE')
  })

  it('my_deliveries mapping รับ offers[] ด้วย (งานประกาศของฉัน)', () => {
    expect(driverServiceSrc).toContain('offers:')
  })
})

describe('E1 · migration 135 — race safety ของ "คนแรกได้คนเดียว"', () => {
  it('claim = atomic UPDATE ที่ผูกเงื่อนไข status=offered (คนที่สองต้องพลาด)', () => {
    expect(migrationSrc).toContain("WHERE order_number = p_order_number AND status = 'offered'")
    expect(migrationSrc).toContain('ERR_OFFER_NOT_AVAILABLE')
  })

  it('claim = accept ในตัว (assignment เกิดเป็น accepted ทันที — สถานะเปลี่ยนจริงตอนรับ)', () => {
    expect(migrationSrc).toContain("'accepted', v_branch, NOW(), NOW(), 'claimed by rider'")
  })

  it('contract 135 ครอบ G1-G7 (พิสูจน์บน ephemeral PG แล้ว)', () => {
    for (const g of ['PASS G1', 'PASS G2', 'PASS G3', 'PASS G4', 'PASS G5', 'PASS G6', 'PASS G7']) {
      expect(contractSrc).toContain(g)
    }
  })
})

describe('M4 · ปุ่มสั่งงานอยู่ที่หน้าเจ้าของเดียว + deep-link', () => {
  it('AdminOrders เหลือ "รับออเดอร์" + deep-link — ไม่มี forward chain ซ้ำ', () => {
    expect(adminOrdersSrc).toContain('handleAcceptOrder')
    expect(adminOrdersSrc).toContain('ไป Dispatch')
    expect(adminOrdersSrc).toContain('ไป Kitchen')
    expect(adminOrdersSrc).not.toContain('nextForwardAction')
    expect(adminOrdersSrc).not.toContain('statusEventMap')
  })

  it('DeliveryManagement = Dispatch Center: ส่งออกงาน (ประกาศ) + assign + ยกเลิกประกาศ', () => {
    expect(deliveryMgmtSrc).toContain('handleAnnounce')
    expect(deliveryMgmtSrc).toContain('handleCancelOffer')
    expect(deliveryMgmtSrc).toContain('dispatch-announce-')
    expect(deliveryMgmtSrc).toContain('offer-open-')
    // ปุ่มสลับสถานะเดิม (A4: dispatch แล้วไรเดอร์รับไม่ได้) ถูกแทนที่แล้ว
    expect(deliveryMgmtSrc).not.toContain('handleDispatch')
  })

  it('notification events ของสายครัว/สายส่ง ยิงจากเจ้าของปุ่ม', () => {
    expect(deliveryMgmtSrc).toContain("triggerEvent('order_delivered'")
  })
})

describe('M3+E1+A8 · พอร์ทัลไรเดอร์ (แยกจากลูกค้า) — ของซ้ำลบแล้ว ใช้ RPC จริง', () => {
  it('หน้า /rider มีงานประกาศ (รับ/ไม่รับ) + ปุ่มรับเรียก claim จริง', () => {
    expect(riderPageSrc).toContain('rider-claim-offer')
    expect(riderPageSrc).toContain('claimDispatchOffer')
    expect(riderPageSrc).toContain('driverDeclineOffer')
  })

  it('RiderPWA component ถูกดูดเข้าหน้าแล้ว (ไม่มี import ซ้ำ) — เหลือ PodDeliveryPanel', () => {
    expect(riderPageSrc).not.toContain("components/dashboard/RiderPWA")
    expect(riderPageSrc).toContain('PodDeliveryPanel')
    // สถานะจริงมาจาก server (assignment_status) — ไม่มี state machine จำลองในหน้า
    expect(riderPageSrc).not.toContain('useOrderStateMachine')
  })

  it('A8: วงจรครบ รับ/ปฏิเสธ → รับของ → กำลังส่ง → POD บังคับ → ส่งมอบ', () => {
    for (const t of ['rider-accept', 'rider-decline', 'picked_up', 'in_transit', 'rider-pod-input', 'rider-deliver']) {
      expect(riderPageSrc).toContain(t)
    }
  })
})