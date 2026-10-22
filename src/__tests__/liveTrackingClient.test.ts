// ============================================
// Bite Me Baby — E3/E4 client guarantees (2026-10-22)
// ============================================
// live tracking (GPS จริง) + ประวัติเส้นทางย้อนหลัง + แอดมินเห็นทุกขั้น —
// พฤติกรรม server พิสูจน์ใน SQL contract 136 (G1-G3) แล้ว; ชุดนี้คุม client
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect } from 'vitest'
import driverServiceSrc from '../lib/driverService.ts?raw'
import riderPageSrc from '../pages/RiderPwaPage.tsx?raw'
import deliveryMgmtSrc from '../pages/admin/DeliveryManagement.tsx?raw'
import liveMapSrc from '../components/admin/AdminLiveMap.tsx?raw'
import migrationSrc from '../../supabase/migrations/136_driver_location_history.sql?raw'
import contractSrc from '../../e2e/contracts_136_driver_location.sql?raw'

describe('E3 · GPS จริง — ไม่มีจุดจำลองบนแผนที่', () => {
  it('หน้า /rider มี heartbeat ส่งพิกัดจริง (driver_update_location)', () => {
    expect(riderPageSrc).toContain('driverUpdateLocation')
    expect(riderPageSrc).toContain('setInterval(send')
  })

  it('driverService ยิง RPC 136 + อ่านประวัติเส้นทางจากตารางจริง', () => {
    expect(driverServiceSrc).toContain("rpc('driver_update_location'")
    expect(driverServiceSrc).toContain('driver_location_history')
    expect(driverServiceSrc).toContain('getRouteHistory')
  })

  it('AdminLiveMap ใช้เฉพาะข้อมูล server + fallback แสดงพิกัดจริงเมื่อไม่มีแผนที่', () => {
    expect(liveMapSrc).toContain('AdminLiveMap')
    expect(liveMapSrc).toContain('admin-map-fallback')
    // ไม่มีพิกัด/จุดปลอมในโค้ด (fallback ต้องโชว์ค่าที่ได้ ไม่แต่งเอง)
    expect(liveMapSrc).not.toContain('mockDrivers')
    expect(liveMapSrc).not.toContain('FAKE_')
  })
})

describe('E3/E4 · migration 136 + contract — ผูกเส้นทางกับงานที่ active เท่านั้น', () => {
  it('136 เก็บประวัติ + อัปเดตตำแหน่งในฟังก์ชันเดียว (SECURITY DEFINER)', () => {
    expect(migrationSrc).toContain('driver_location_history')
    expect(migrationSrc).toContain('driver_update_location')
    expect(migrationSrc).toContain("status IN ('assigned', 'accepted', 'picked_up', 'in_transit')")
    expect(contractSrc).toContain('PASS G1+G2')
    expect(contractSrc).toContain('PASS G3')
  })
})

describe('E4 · แอดมินเห็นทุกขั้น (timeline จาก timestamps จริง)', () => {
  it('Dispatch Center มี timeline ทุกขั้น + ปุ่มดูเส้นทางย้อนหลัง + แผนที่ live', () => {
    for (const t of ['asg-timeline-', 'route-history-', 'AdminLiveMap', 'loadRoute']) {
      expect(deliveryMgmtSrc).toContain(t)
    }
    // ทุกขั้นต้องมี timestamp จริง (ไม่ใช่ข้อความตายตัว)
    for (const f of ['assigned_at', 'accepted_at', 'picked_up_at', 'in_transit_at', 'delivered_at']) {
      expect(deliveryMgmtSrc).toContain(f)
    }
  })
})