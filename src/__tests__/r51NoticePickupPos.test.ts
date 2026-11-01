// ============================================
// Bite Me Baby — R51 (Owner batch 2026-11-01):
//  ① Notice/หมายเหตุรายเมนู + ช้อนส้อม (default ไม่รับ) ในกล่องโต้ตอบใส่ตะกร้า
//  ② Digital pickup — ครัว/Dispatch/Track = ไม่เรียกไรเดอร์ · ป้าย รับที่ร้าน
//  ③ POS เพิ่ม ทานที่ร้าน/สั่งกลับบ้าน + เปิด-ปิดแยกหมวด (ผูก engine เดิม 127)
//  ④ Density หัวฉีด 1-5 (แก้ "เครื่องดังแต่ปริ้นไม่ออก")
// ============================================
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })) })) } }))

import { useCartStore } from '@/store/cartStore'
import { DEFAULT_PRINTER_SETTINGS } from '@/lib/printService'
import { fulfillmentBadge } from '@/lib/adminOrderDisplay'
import {
  normalizePosServiceFlags, posServiceInstruction,
  POS_SERVICE_META, DEFAULT_POS_SERVICE_FLAGS, POS_SERVICE_TYPES_KEY,
} from '@/lib/posApi'

import obmSrc from '@/components/order/OrderBuilderModal.tsx?raw'
import orderEntrySrc from '@/lib/orderEntry.ts?raw'
import checkoutSrc from '@/pages/CheckoutPage.tsx?raw'
import kitchenSrc from '@/pages/admin/AdminKitchen.tsx?raw'
import deliverySrc from '@/pages/admin/DeliveryManagement.tsx?raw'
import trackSrc from '@/pages/OrderTrackPage.tsx?raw'
import adminOrdersSrc from '@/pages/admin/AdminOrders.tsx?raw'
import adminPosSrc from '@/pages/admin/AdminPos.tsx?raw'
import posApiSrc from '@/lib/posApi.ts?raw'
import printSrc from '@/lib/printService?raw'
import adminPrintSrc from '@/pages/admin/AdminPrintSettings.tsx?raw'
import niimbotSrc from '@/lib/niimbotBt.ts?raw'
import stickerQueueSrc from '@/lib/stickerQueue.ts?raw'

// ---------------------------------------------------------------------------
// ① Notice + ช้อนส้อม
// ---------------------------------------------------------------------------
describe('R51 ① Notice/หมายเหตุ + ช้อนส้อม ในกล่องโต้ตอบใส่ตะกร้า', () => {
  it('OrderBuilderModal: label ครบ · placeholder ตัวจาง · checkbox ช้อนส้อมผูก cartStore (default ไม่รับ)', () => {
    expect(obmSrc).toContain('Notice/หมายเหตุถึงร้าน(ไม่จำเป็นต้องระบุ)')
    expect(obmSrc).toContain('placeholder="ระบุรายละเอียดคำขอ(ขึ้นอยู่กับดุลพินิจของทางร้าน)"')
    expect(obmSrc).toContain('data-testid="ob-notice"')
    expect(obmSrc).toContain('data-testid="ob-notice-section"')
    expect(obmSrc).toContain('data-testid="ob-cutlery"')
    expect(obmSrc).toContain('checked={cutlery}')
    expect(obmSrc).toContain('setCutlery(e.target.checked)')
    expect(obmSrc).toContain('ค่าเริ่มต้น: ไม่รับ')
    expect(obmSrc).toContain('notice: notice.trim()')
  })

  it('orderEntry: notice จาก dialog → customizations.notice ของบรรทัด (ไม่ทับ addOns)', () => {
    expect(orderEntrySrc).toContain("customizations['notice']")
    expect(orderEntrySrc).toContain('result.notice.trim()')
  })

  it('cartStore: cutlery default false · setCutlery · clearCart รีเซ็ตเป็น false', () => {
    const s = useCartStore.getState()
    expect(s.cutlery).toBe(false)
    s.setCutlery(true)
    expect(useCartStore.getState().cutlery).toBe(true)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().cutlery).toBe(false)
  })

  it('Checkout: notice ยกเป็น special_request (options ไม่พก notice) + ช้อนส้อม → special_instructions', () => {
    expect(checkoutSrc).toContain('const { notice: lineNotice, ...restOptions }')
    expect(checkoutSrc).toContain('special_request: trimmedNotice')
    expect(checkoutSrc).toContain("special_instructions: useCartStore.getState().cutlery ? 'รับช้อนส้อม' : ''")
    expect(checkoutSrc).toContain("delivery_method: fulfillment === 'pickup' ? 'pickup' : 'self_delivery'")
    expect(checkoutSrc).toContain('data-testid="fulfillment-pickup"')
  })
})

// ---------------------------------------------------------------------------
// ② Digital pickup — ไม่เรียกไรเดอร์
// ---------------------------------------------------------------------------
describe('R51 ② Pickup = ไม่เรียกไรเดอร์ · ป้าย/คำในคิวครัว-ดิสแพตช์-ติดตาม', () => {
  it('fulfillmentBadge: pickup = ป้ายรับที่ร้าน · method อื่น = null', () => {
    const b = fulfillmentBadge('pickup')
    expect(b?.label).toContain('รับที่ร้าน')
    expect(fulfillmentBadge('self_delivery')).toBeNull()
    expect(fulfillmentBadge(undefined)).toBeNull()
  })

  it('AdminKitchen: ป้าย pickup + คำ "พร้อมรับที่ร้าน" + ไม่เรียกไรเดอร์ + โชว์ special_instructions', () => {
    expect(kitchenSrc).toContain('fulfillmentBadge(o.delivery_method)')
    expect(kitchenSrc).toContain("'✅ พร้อมรับที่ร้าน'")
    expect(kitchenSrc).toContain('ไม่เรียกไรเดอร์')
    expect(kitchenSrc).toContain('data-testid="kitchen-order-notice"')
    expect(kitchenSrc).toContain('{o.special_instructions ? (')
  })

  it('Dispatch Center: pickup ถูกกันออกจาก readyQ/enroute (ไม่ขึ้นคิวมอบหมายไรเดอร์)', () => {
    expect(deliverySrc).toContain("o.delivery_method !== 'pickup'")
    expect(deliverySrc).toContain('ไม่ต้องมีเรียกไรเดอร์')
  })

  it('หน้าติดตามลูกค้า: ป้ายรับที่ร้าน + สถานะพร้อมรับ (ไม่ใช่ "รอคนส่งรับ") เมื่อเป็น pickup', () => {
    expect(trackSrc).toContain('🛍️ รับที่ร้าน')
    expect(trackSrc).toContain('อาหารพร้อมแล้ว — มารับที่หน้าร้าน (แสดงรหัสรับอาหาร)')
  })

  it('AdminOrders: การ์ดออเดอร์มีป้าย fulfillment pickup', () => {
    expect(adminOrdersSrc).toContain('fulfillmentBadge(order.delivery_method)')
    expect(adminOrdersSrc).toContain('ffbBadge')
  })
})

// ---------------------------------------------------------------------------
// ③ POS — ทานที่ร้าน / สั่งกลับบ้าน + เปิด-ปิดแยกหมวด (ผูก 127 เดิม)
// ---------------------------------------------------------------------------
describe('R51 ③ POS service categories', () => {
  it('posApi: key + meta 3 หมวด + default เปิดครบ + normalize อ่านค่าบางส่วนได้', () => {
    expect(POS_SERVICE_TYPES_KEY).toBe('pos_service_types')
    expect(Object.keys(POS_SERVICE_META)).toEqual(['dine_in', 'takeaway', 'pickup'])
    expect(DEFAULT_POS_SERVICE_FLAGS).toEqual({ dine_in: true, takeaway: true, pickup: true })
    const n = normalizePosServiceFlags({ dine_in: false, bogus: true })
    expect(n.dine_in).toBe(false)
    expect(n.takeaway).toBe(true)
    expect(n.pickup).toBe(true)
    expect(normalizePosServiceFlags(null)).toEqual(DEFAULT_POS_SERVICE_FLAGS)
    expect(normalizePosServiceFlags('x')).toEqual(DEFAULT_POS_SERVICE_FLAGS)
  })

  it('posServiceInstruction: ป้ายชนิดแนบหัว Notice (+โต๊ะ เฉพาะ dine_in)', () => {
    expect(posServiceInstruction('takeaway')).toBe('สั่งกลับบ้าน')
    expect(posServiceInstruction('pickup')).toBe('รับที่ร้าน')
    expect(posServiceInstruction('dine_in')).toBe('ทานที่ร้าน')
    expect(posServiceInstruction('dine_in', ' โต๊ะ 3 ')).toBe('ทานที่ร้าน โต๊ะ 3')
    expect(posServiceInstruction('takeaway', 'โต๊ะ 3')).toBe('สั่งกลับบ้าน')
  })

  it('AdminPos: ปุ่มเลือกเฉพาะหมวดที่เปิด · card เปิด/ปิด · ปุ่มขายบอกชนิด · engine เดิม 127', () => {
    expect(adminPosSrc).toContain('data-testid="pos-service-types"')
    expect(adminPosSrc).toContain('data-testid={`pos-service-${k}`}')
    expect(adminPosSrc).toContain('data-testid="pos-service-settings"')
    expect(adminPosSrc).toContain('data-testid={`pos-flag-${k}`}')
    expect(adminPosSrc).toContain('posServiceInstruction(serviceType, seat)')
    expect(adminPosSrc).toContain('loadPosServiceFlags()')
    expect(adminPosSrc).toContain('savePosServiceFlags(')
    expect(posApiSrc).toContain("supabase.rpc('create_pickup_order_i'")
    expect(adminPosSrc).toContain(`fulfillment: 'pickup' as const`)
  })
})

// ---------------------------------------------------------------------------
// ④ Density (แก้ "เครื่องดังแต่ปริ้นไม่ออก")
// ---------------------------------------------------------------------------
describe('R51 ④ Density หัวฉีด 1-5 + คู่มือ "ดังแต่ไม่ออก"', () => {
  it('default 3 คงเดิม · settings มี stickerDensity', () => {
    expect(DEFAULT_PRINTER_SETTINGS.stickerDensity).toBe(3)
    expect(printSrc).toContain('stickerDensity?: number')
  })

  it('ส่ง density ครบทั้งสาย: settings → stickerQueue → niimbot (ไม่ hardcode 3 อีก)', () => {
    expect(stickerQueueSrc).toContain('density: opts?.density')
    expect(niimbotSrc).toContain('density: opts?.density ?? 3')
    expect(niimbotSrc).toContain('const density = opts?.density ?? 3')
    expect(adminOrdersSrc).toContain('density: settings.stickerDensity ?? 3')
    expect(adminPrintSrc).toContain('density: settings.stickerDensity ?? 3')
    expect(adminPrintSrc).toContain('data-testid="sticker-density"')
    expect(adminPrintSrc).toContain('data-testid="bt-density-row"')
  })

  it('คู่มือหน้าตั้งค่ามีเคส "ส่งเสียงยืนยันแต่ปริ้นไม่ออก"', () => {
    expect(adminPrintSrc).toContain('ส่งเสียงยืนยัน แต่กระดาษไม่ออก')
    expect(adminPrintSrc).toContain('ไดรเวอร์ Text Only')
  })
})


