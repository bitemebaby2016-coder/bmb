// ============================================
// Bite Me Baby — R47 (Owner 2026-11-17): AdminLiveMap Leaflet/OSM fallback
// ============================================
// บั๊กจริง: แอดมินเป็นฝั่งเดียวที่ไม่มี fallback map — Google ล้มในเบราว์เซอร์
// (key ถูกปฏิเสธ) → เห็นแต่ข้อความพิกัด ทั้งที่ไรเดอร์/ลูกค้าโชว์แผนที่ได้จาก Leaflet
// แก้: ยก loadLeaflet เป็น lib เดียวทั้งระบบ + AdminLiveMap ใช้ pattern เดียวกับ
// RiderMiniMap (div ตลอด + Leaflet ยึด div เดิม + จุดจริง + จุดเก่าจาง)
import { describe, it, expect } from 'vitest'
import leafletLoaderSrc from '../lib/leafletLoader.ts?raw'
import miniMapSrc from '../components/rider/RiderMiniMap.tsx?raw'
import liveMapSrc from '../components/admin/AdminLiveMap.tsx?raw'

describe('R47 — leafletLoader เป็น single source ของทุกแผนที่', () => {
  it('lib: CDN unpkg 1.9.4 + SRI integrity + OSM tile/attribution', () => {
    expect(leafletLoaderSrc).toContain('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
    expect(leafletLoaderSrc).toContain("integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='")
    expect(leafletLoaderSrc).toContain('OSM_TILE')
    expect(leafletLoaderSrc).toContain('OSM_ATTRIBUTION')
    expect(leafletLoaderSrc).toContain('if ((window as any).L) return Promise.resolve()')
  })

  it('RiderMiniMap ใช้ loader กลาง (ไม่ copy CDN loader ซ้ำ) — คง innerHTML เคลียร์ไว้', () => {
    expect(miniMapSrc).toContain("from '@/lib/leafletLoader'")
    expect(miniMapSrc).not.toContain('unpkg.com')
    expect(miniMapSrc).toContain('innerHTML')
  })
})

describe('R47 — AdminLiveMap: fallback map แบบเดียวกับ RiderMiniMap', () => {
  it('div แผนที่ render ตลอด (บั๊ก render-order รอบ 45) — ไม่ gate ด้วย status', () => {
    expect(liveMapSrc).toContain('<div ref={mapRef} className="w-full h-64 rounded-lg border border-brand-border"')
    expect(liveMapSrc).not.toContain("? (")
    expect(liveMapSrc).toContain('R47: div แผนที่ render ตลอด')
  })

  it('Google ล้ม → Leaflet ยึด div: เคลียร์ DOM + OSM tiles + cleanup remove()', () => {
    expect(liveMapSrc).toContain("from '@/lib/leafletLoader'")
    expect(liveMapSrc).toContain('innerHTML')
    expect(liveMapSrc).toContain('L.tileLayer(OSM_TILE')
    expect(liveMapSrc).toContain('leafletMapRef.current.remove()')
  })

  it('จุดไรเดอร์จริงเท่านั้น — ไม่มีข้อมูลปลอม (mockDrivers/FAKE_ = ห้ามมี)', () => {
    expect(liveMapSrc).not.toContain('mockDrivers')
    expect(liveMapSrc).not.toContain('FAKE_')
  })

  it('จุดเก่า (R46) = สีเทา/จาง + tooltip label อายุ ทั้ง Google และ Leaflet mode', () => {
    expect(liveMapSrc).toContain('opacity: age.stale ? 0.4 : 1')
    expect(liveMapSrc).toContain("age.stale ? '#9ca3af' : '#16a34a'")
    expect(liveMapSrc).toContain('positionAgeInfo(d.lastSeenAt)')
    expect(liveMapSrc).toContain('ตำแหน่งเก่า')
  })

  it('polyline เส้นทางย้อนหลังทำงานใน Leaflet mode ด้วย (route จริงจาก server)', () => {
    expect(liveMapSrc).toContain('L.polyline(')
    expect(liveMapSrc).toContain("color: '#2563eb'")
  })

  it('คงสัญญาเดิม: admin-map-fallback + รายงานพิกัดจริงตอน unavailable', () => {
    expect(liveMapSrc).toContain('data-testid="admin-map-fallback"')
    expect(liveMapSrc).toContain('data-testid="admin-live-map"')
  })
})
