// ============================================
// Bite Me Baby — R16 tests (Owner 2026-10-28):
//   1) strip: สองบรรทัด "ขนาดเท่ากัน" + สี 🟢/🔴 ตามจริงรายสาย (sameDayOpen/preOrderOpen)
//   2) คำ "คัทออฟ" → "ปิดรอบ" ทุกจุด (src = 0 จุด)
//   3) เครื่องไรเดอร์: แผนที่จุดหมาย + route หลายจุด (deliveryPlan ล้วน ๆ) + Google Maps link
//   4) multi-job rider: migration 168 = delivered คืน available เฉพาะเมื่อไม่งานค้าง
// ============================================
import { describe, it, expect } from 'vitest'
import { getStoreStatusFromRounds } from '@/lib/homeProviders'
import { planMultiStopRoute, googleMapsDirUrl, toPlanStops, type PlanStop } from '@/lib/deliveryPlan'
import { roundCutoffLabel } from '@/lib/deliveryRoundStatus'
import stripSrc from '../components/home/StoreStatusStrip.tsx?raw'
import riderSrc from '../pages/RiderPwaPage.tsx?raw'
import miniMapSrc from '../components/rider/RiderMiniMap.tsx?raw'
import homeSrc from '../lib/homeProviders.ts?raw'
import mig168Src from '../../supabase/migrations/168_multi_job_rider_route.sql?raw'

const TODAY = '2026-10-28'
const TOMORROW = '2026-10-29'
const atBkk = (iso: string) => new Date(Date.parse(iso))

describe('R16 — strip: สองบรรทัดขนาดเท่ากัน + สีสถานะตามจริงรายสาย', () => {
  it('เซมเดย์เปิด + พรีออเดอร์รอบถัดไป → sameDayOpen/preOrderOpen = true ทั้งคู่ (🟢 ทั้งสอง)', () => {
    const s = getStoreStatusFromRounds(
      [
        { status: 'active', display_name: 'SameDay', delivery_start: '06:00', delivery_end: '23:00', max_capacity: 10, current_count: 1, scheduled_date: TODAY },
        { status: 'active', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', cutoff_time: '05:00', max_capacity: 60, current_count: 0, scheduled_date: TOMORROW },
      ] as never,
      atBkk('2026-10-28T04:00:00+07:00'),
    )
    expect(s.sameDayOpen).toBe(true)
    expect(s.preOrderOpen).toBe(true)
    expect(s.preOrderLine).toMatch(/\(ปิดรอบ \d{2}:\d{2}\)/) // ปิดรอบจริงจาก delivery_start − cutoff_hours (06:00 − 2 = 04:00)
  })

  it('รอบวันนี้เต็ม (เซมเดย์ปิด) + มีรอบพรุ่งนี้ → sameDayOpen=false แต่ preOrderOpen=true (คนละสีได้)', () => {
    const s = getStoreStatusFromRounds(
      [
        { status: 'active', display_name: 'SameDay', delivery_start: '06:00', delivery_end: '23:00', max_capacity: 1, current_count: 1, scheduled_date: TODAY },
        { status: 'active', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', cutoff_time: '05:00', max_capacity: 60, current_count: 0, scheduled_date: TOMORROW },
      ] as never,
      atBkk('2026-10-28T10:00:00+07:00'),
    )
    expect(s.state).toBe('preorder_only')
    expect(s.sameDayOpen).toBe(false) // strip บรรทัดบน = 🔴
    expect(s.preOrderOpen).toBe(true) // บรรทัดล่าง = 🟢
  })

  it('ไม่มีรอบเปิดเลย → sameDayOpen/preOrderOpen = false ทั้งคู่ (🔴 ทั้งสอง)', () => {
    const s = getStoreStatusFromRounds([] as never, atBkk('2026-10-28T10:00:00+07:00'))
    expect(s.sameDayOpen).toBe(false)
    expect(s.preOrderOpen).toBe(false)
  })

  it('strip source: font สองบรรทัดเท่ากัน + สีจาก flag + ไม่ opacity/truncate', () => {
    expect(stripSrc).toContain("sameDayOpen ? '🟢' : '🔴'")
    expect(stripSrc).toContain("preOrderOpen ? '🟢' : '🔴'")
    expect(stripSrc).toContain('data-testid="strip-sameday"')
    expect(stripSrc).toContain('data-testid="strip-preorder"')
    expect((stripSrc.match(/text-sm sm:text-base font-bold/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(stripSrc).not.toMatch(/opacity-80/)
    expect(stripSrc).not.toContain('font-bold truncate') // class truncate ถูกถอดออกจากทั้งสองบรรทัด
  })

  it('homeProviders คืน flag ครบทุก branch (4 return sites)', () => {
    expect((homeSrc.match(/sameDayOpen:/g) || []).length).toBeGreaterThanOrEqual(4)
    expect((homeSrc.match(/preOrderOpen:/g) || []).length).toBeGreaterThanOrEqual(4)
  })
})

describe('R16 — คำว่า "คัทออฟ" ถูกแทนด้วย "ปิดรอบ" ทุกจุด (src = 0)', () => {
  it('roundCutoffLabel SAME_DAY = "ไม่มีปิดรอบ" (ไม่ใช่ ไม่มีคัทออฟ)', () => {
    expect(roundCutoffLabel({ delivery_start: '09:00' }, 'SAME_DAY')).toBe('ไม่มีปิดรอบ')
  })

  it('strip/homeProviders/rider ไม่มีคำ คัทออฟ เหลือ (assert source จริง)', () => {
    expect(stripSrc).not.toContain('คัทออฟ')
    expect(homeSrc).not.toContain('คัทออฟ')
    expect(riderSrc).not.toContain('คัทออฟ')
  })
})
describe('R16 — เครื่องไรเดอร์: แผนที่จุดหมาย + เส้นทางหลายจุด (deliveryPlan ล้วน)', () => {
  const O = { latitude: 12.6, longitude: 102.1 }
  const stops: PlanStop[] = [
    { order_number: 'FAR', latitude: 12.65, longitude: 102.15 },
    { order_number: 'NEAR', latitude: 12.601, longitude: 102.101 },
    { order_number: 'MID', latitude: 12.62, longitude: 102.12 },
  ]

  it('planMultiStopRoute = nearest-neighbour จากจุดเริ่ม + ระยะทางรวม/ขา', () => {
    const plan = planMultiStopRoute(O, stops)
    expect(plan.stops.map((s) => s.order_number)).toEqual(['NEAR', 'MID', 'FAR'])
    expect(plan.noOrigin).toBe(false)
    expect(plan.legKm).toHaveLength(3)
    expect(plan.legKm[0]).toBeLessThan(plan.legKm[2])
    expect(plan.totalKm).toBeGreaterThan(0)
  })

  it('ไม่มีจุดเริ่ม → คงลำดับเดิม + noOrigin (ไม่เดา)', () => {
    const plan = planMultiStopRoute(null, stops)
    expect(plan.stops.map((s) => s.order_number)).toEqual(['FAR', 'NEAR', 'MID'])
    expect(plan.noOrigin).toBe(true)
    expect(plan.totalKm).toBe(0)
  })

  it('toPlanStops: กรอง null/NaN ทิ้ง (งานไม่มีพิกัด = ไม่เข้า route)', () => {
    const rows = [
      { order_number: 'A', dropoff_latitude: 12.6, dropoff_longitude: 102.1, dropoff_detail: 'x' },
      { order_number: 'B', dropoff_latitude: null, dropoff_longitude: 102.1, dropoff_detail: null },
      { order_number: 'C', dropoff_latitude: Number('not-a-number'), dropoff_longitude: 102.1 },
    ]
    expect(toPlanStops(rows).map((s) => s.order_number)).toEqual(['A'])
  })

  it('googleMapsDirUrl: origin → waypoints → destination (ฟรี ไม่ใช้ key)', () => {
    const plan = planMultiStopRoute(O, stops)
    const url = googleMapsDirUrl(O, plan.stops)
    expect(url).toBeTruthy()
    const decoded = decodeURIComponent(url!)
    expect(decoded).toContain('www.google.com/maps/dir/')
    expect(decoded).toContain(`origin=${O.latitude},${O.longitude}`)
    expect(decoded).toContain('destination=12.65,102.15') // FAR = จุดสุดท้ายของลำดับ
    expect(decoded).toContain('waypoints=')
    expect(decoded).toContain('travelmode=driving')
    expect(googleMapsDirUrl(O, [])).toBeNull()
  })
})

describe('R16 — RiderPwaPage/RiderMiniMap source: route card + แผนที่หลายจุด', () => {
  it('RiderPwaPage มี route card: planMultiStopRoute + stops + ปุ่มเปิด Google Maps', () => {
    expect(riderSrc).toContain('rider-route-plan')
    expect(riderSrc).toContain('planMultiStopRoute(origin, stops)')
    expect(riderSrc).toContain('googleMapsDirUrl')
    expect(riderSrc).toContain('rider-open-gmaps')
    expect(riderSrc).toContain("['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived']")
  })

  it('RiderMiniMap รับ stops: ปักจุด 1..N + polyline + clear-marker เก่า', () => {
    expect(miniMapSrc).toContain('stops?: PlanStop[] | null')
    expect(miniMapSrc).toContain('stop-${s.order_number}')
    expect(miniMapSrc).toContain('g.maps.Polyline')
    expect(miniMapSrc).toContain('old?.setMap?.(null)')
  })
})

describe('R16 — migration 168: multi-job (delivered ห้ามปลด busy ถ้างานค้าง)', () => {
  it('conditional free: NOT EXISTS งานค้าง (status IN รวม arrived) + คง gates เดิม', () => {
    expect(mig168Src).toContain('OR NOT EXISTS (')
    expect(mig168Src).toContain("da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')")
    expect(mig168Src).toContain("p_status <> 'delivered'")
    expect(mig168Src).toContain('ERR_POD_REQUIRED')
    expect(mig168Src).toContain('ERR_GEOFENCE')
    expect(mig168Src).toContain('ERR_DELIVERY_SYNC_BLOCKED')
  })

  it('ACL: ไม่มี PUBLIC/anon — authenticated เท่านั้น (เท่า 163)', () => {
    expect(mig168Src).toContain('REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status')
    expect(mig168Src).toContain('FROM anon')
    expect(mig168Src).toContain('TO authenticated')
  })
})