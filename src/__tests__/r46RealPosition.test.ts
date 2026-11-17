// ============================================
// Bite Me Baby — R46 (Owner 2026-11-17): ตำแหน่งจริงร่วมกัน 3 ฝั่ง — source contracts
// ============================================
// บั๊กจริง production: จุด กทม. (13.713, 100.4365) โชว์ทั้งแอดมิน + หน้าลูกค้า
// = ข้อมูลทดสอบ AI ค้างใน drivers.current_* (Owner ยืนยัน 2026-11-17 ให้ลบทิ้ง)
// + list_drivers() ไม่กรอง tenant → แผนที่ Dispatch โชว์ไรเดอร์ข้ามแบรนด์ได้
// + UI ไม่ตัดสินตำแหน่งเก่า → พิกัดค้างถูกอวดเป็น live
import { describe, it, expect } from 'vitest'
import mig180Src from '../../supabase/migrations/180_real_position_shared_3_sides.sql?raw'
import liveMapSrc from '../components/admin/AdminLiveMap.tsx?raw'
import deliveryMgmtSrc from '../pages/admin/DeliveryManagement.tsx?raw'
import driverServiceSrc from '../lib/driverService.ts?raw'
import orderTrackSrc from '../pages/OrderTrackPage.tsx?raw'
import freshSrc from '../lib/positionFreshness.ts?raw'

describe('R46 — migration 180: ลบไรเดอร์ทดสอบ + list_drivers tenant filter', () => {
  it('ลบไรเดอร์ทดสอบ "พลอย ในไทยโกฯ" พร้อม guard งานกำลังส่งจริง (ห้ามลบทับงานจริง)', () => {
    expect(mig180Src).toContain("'พลอย ในไทยโกฯ'")
    expect(mig180Src).toContain("AND da.status IN ('accepted', 'picked_up', 'in_transit', 'arrived')")
    expect(mig180Src).toContain('NOT EXISTS')
  })

  it('list_drivers ต้องกรอง tenant (d.tenant_id = v_tenant — pattern m125) + คืน last_seen_at', () => {
    expect(mig180Src).toContain('v_tenant := public.default_tenant_id()')
    expect(mig180Src).toContain('WHERE d.tenant_id = v_tenant')
    expect(mig180Src).toContain("'last_seen_at', r.last_seen_at")
    expect(mig180Src).toContain('REVOKE EXECUTE ON FUNCTION public.list_drivers() FROM PUBLIC, anon')
    expect(mig180Src).toContain('GRANT EXECUTE ON FUNCTION public.list_drivers() TO authenticated')
  })

  it('migration ต้องมี verification ตัดเกม (ล้มถ้าไม่มี filter/last_seen_at)', () => {
    expect(mig180Src).toContain('ERR_VERIFY_LIST_DRIVERS_TENANT')
    expect(mig180Src).toContain('ERR_VERIFY_LIST_DRIVERS_SEEN')
  })
})

describe('R46 — UI ตัดสินตำแหน่งเก่าทุกฝั่ง (ไม่อวด live)', () => {
  it('AdminLiveMap: รับ lastSeenAt + จุดเก่าจาง (opacity) + title/fallback บอก label จาก positionAgeInfo', () => {
    expect(liveMapSrc).toContain('lastSeenAt')
    expect(liveMapSrc).toContain('positionAgeInfo(d.lastSeenAt)')
    expect(liveMapSrc).toContain('opacity: age.stale ? 0.4 : 1')
    expect(liveMapSrc).toContain('ตำแหน่งเก่า')
  })

  it('DeliveryManagement: ส่ง last_seen_at เข้าแผนที่ + การ์ดไรเดอร์โชว์ GPS label', () => {
    expect(deliveryMgmtSrc).toContain('lastSeenAt: (d as { last_seen_at?: string | null }).last_seen_at ?? null')
    expect(deliveryMgmtSrc).toContain('positionAgeInfo(d.last_seen_at).label')
  })

  it('driverService: AdminDriverRow มี last_seen_at (m180)', () => {
    expect(driverServiceSrc).toContain('last_seen_at: string | null')
    expect(driverServiceSrc).toContain('m180 tenant filter')
  })

  it('หน้าลูกค้า /track: ตำแหน่งเก่าเตือนชัด + data-testid track-rider-pos-age', () => {
    expect(orderTrackSrc).toContain('positionAgeInfo(riderPos.updated_at).stale')
    expect(orderTrackSrc).toContain('data-testid="track-rider-pos-age"')
    expect(orderTrackSrc).toContain('รอไรเดอร์เปิดหน้าส่งพิกัดใหม่')
  })

  it('positionFreshness: เกณฑ์ 10 นาที + ไม่มีเวลา = ถือว่าเก่า (ห้ามอวด live)', () => {
    expect(freshSrc).toContain('POSITION_STALE_MIN = 10')
    expect(freshSrc).toContain("stale: true, known: false")
  })
})
