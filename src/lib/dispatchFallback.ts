// ============================================
// Bite Me Baby — EV Rider auto-dispatch FALLBACK (Master Prompt Task 3 · T3-b)
// ============================================
// กติกา: "ไม่มีไรเดอร์ EV ว่าง หรือ ตำแหน่งส่งอยู่นอกรัศมี 0–5 กม.
//         → สลับไปเรียกบริการภายนอก (Grab Express / Lalamove) อัตโนมัติ"
// หน้าที่ไฟล์นี้:
//   * evaluateRiderFallback — PURE decision (test ตรง ๆ · ไม่ยิง network)
//   * requestExternalDispatchFallback — ใช้ providerRegistry ที่มีอยู่แล้ว
//     (grab/lineman/foodpanda/lalamove adapter — ไม่สร้าง logic ขนส่งใหม่ซ้ำ)
// ข้อจำกัดโดยเจตนา (inspect ก่อนเขียน):
//   * provider ทั้งหมด status ≠ live (ยังไม่มี credentials — docs/02) → ผลลัพธ์
//     จึงเป็น 'mock' อย่างตรงไปตรงมา ห้ามแกล้งทำเป็นสั่งจริง
//   * จุดต่อจริงในระบบ = DeliveryManagement (สร้าง offer เมื่อไม่มีไรเดอร์รับ)
//     — เรียกฟังก์ชันนี้จากที่นั่นเมื่อผล evaluate = external (wire = รอบถัดไป)
// ============================================

import { providerRegistry } from './providers/registry'
import type { ProviderId } from './providers/types'

/** รัศมีรับงานของไรเดอร์ภายใน (กม.) — ตาม requirement 0–5 กม. */
export const MAX_INTERNAL_RADIUS_KM = 5

export type FallbackReason = 'riders_available' | 'no_available_rider' | 'out_of_radius'

export interface FallbackDecision {
  action: 'internal' | 'external'
  reason: FallbackReason
  /** ข้อความไทยอธิบายการตัดสิน (โชว์ใน dispatch log/UI ได้) */
  message: string
}

export interface FallbackInput {
  availableRiderCount: number
  distanceKm: number
  /** ปรับรัศมีได้ต่อการเรียก (ค่าเริ่มต้น = 5 กม. · ค่าเพี้ยนใช้ 5) */
  maxRadiusKm?: number
}

function safeMaxRadius(v: number | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : MAX_INTERNAL_RADIUS_KM
}

/**
 * ตัดสิน: ส่งงานเข้าระบบไรเดอร์ภายใน หรือ สลับผู้ให้บริการภายนอก (pure)
 * - นอกรัศมี → external แม้จะมีไรเดอร์ว่าง (งานอยู่คนละโซน)
 * - ในรัศมีแต่ไม่มีไรเดอร์ว่าง → external
 * - ในรัศมี + มีไรเดอร์ → internal (ระบบเดิมทำงานต่อ)
 */
export function evaluateRiderFallback(input: FallbackInput): FallbackDecision {
  const maxRadius = safeMaxRadius(input?.maxRadiusKm)
  const riders = Math.max(0, Math.floor(Number(input?.availableRiderCount) || 0))
  const rawKm = Number(input?.distanceKm)
  const km = Number.isFinite(rawKm) ? Math.max(0, rawKm) : 0

  if (km > maxRadius) {
    return {
      action: 'external',
      reason: 'out_of_radius',
      message: `จุดส่งอยู่ห่าง ${km.toFixed(1)} กม. (เกินรัศมี ${maxRadius} กม.) — สลับไปผู้ให้บริการภายนอก`,
    }
  }
  if (riders <= 0) {
    return {
      action: 'external',
      reason: 'no_available_rider',
      message: `ไม่มีไรเดอร์ว่างในรัศมี ${maxRadius} กม. — สลับไปผู้ให้บริการภายนอก`,
    }
  }
  return {
    action: 'internal',
    reason: 'riders_available',
    message: `มีไรเดอร์ว่าง ${riders} คนในรัศมี ${maxRadius} กม. — ใช้ระบบภายในตามเดิม`,
  }
}

export interface ExternalDispatchRequest {
  orderNumber: string
  pickup: { latitude: number; longitude: number }
  dropoff: { latitude: number; longitude: number }
  itemsCount: number
  totalWeightKg: number
}

export interface ExternalDispatchResult {
  ok: boolean
  /** 'live' = เรียก API จริงสำเร็จ · 'mock' = adapter ยังไม่มี key (งานโครง · ไม่ใช่สั่งจริง) */
  kind: 'live' | 'mock' | 'failed'
  providerId: ProviderId | null
  externalOrderId: string | null
  message: string
}

/** ลำดับเรียกผู้ให้บริการภายนอก (ตาม requirement: Grab Express / Lalamove ก่อน) */
export const EXTERNAL_PROVIDER_PRIORITY: ProviderId[] = ['grab', 'lalamove', 'lineman', 'foodpanda']

/**
 * เรียกผู้ให้บริการภายนอกคนแรกที่รับงานได้ — ใช้ registry/adapter เดิมทั้งหมด
 * ไม่มี key จริง = ได้ผล 'mock' พร้อม message บอกตรง ๆ (ไม่มีการแกล้งเป็น live)
 */
export async function requestExternalDispatchFallback(
  req: ExternalDispatchRequest,
): Promise<ExternalDispatchResult> {
  for (const id of EXTERNAL_PROVIDER_PRIORITY) {
    try {
      const adapter = providerRegistry.get(id)
      const delivery = await adapter.requestDelivery({
        orderNumber: req.orderNumber,
        pickup: req.pickup,
        dropoff: req.dropoff,
        itemsCount: req.itemsCount,
        totalWeightKg: req.totalWeightKg,
      })
      const isLive = adapter.status === 'live'
      return {
        ok: true,
        kind: isLive ? 'live' : 'mock',
        providerId: id,
        externalOrderId: delivery.externalOrderId,
        message: isLive
          ? `สั่งงาน ${adapter.label} แล้ว (${delivery.externalOrderId})`
          : `${adapter.label} = งานโครง (mockup_pending · ยังไม่มี key จริง) — ${delivery.externalOrderId} (provider_orders ยังไม่มีแถวจริง)`,
      }
    } catch {
      // adapter คนถัดไป — ข้ามอย่างเงียบ ๆ (try ครบวงจร = จุดเดียว)
    }
  }
  return {
    ok: false,
    kind: 'failed',
    providerId: null,
    externalOrderId: null,
    message: 'ผู้ให้บริการภายนอกทุกรายตอบไม่ได้ในขณะนี้ — แจ้งแอดมินให้ประสานงานด้วยตนเอง',
  }
}