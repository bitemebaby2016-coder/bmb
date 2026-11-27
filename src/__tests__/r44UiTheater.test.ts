// ============================================
// Bite Me Baby — R44 UI (Owner 2026-11-01)
//   ① Theater: การ์ดเมนูลิงก์จริงไป /menu + ปุ่มตามโหมด (พรีออเดอร์ = จองล่วงหน้า)
//   ② มุมขวา: bubble มาสคอต anchor เบ้นอกขอบจอ + music pill ไม่ทับ cluster (ยุบทับซ้อน)
// ============================================

import { describe, it, expect } from 'vitest'
import theaterCardsSrc from '../components/theater/TheaterCards.tsx?raw'
import mascotSrc from '../components/ai/BiteMascot.tsx?raw'
import musicSrc from '../components/audio/AmbientMusicToggle.tsx?raw'
import adminOrdersSrc from '../pages/admin/AdminOrders.tsx?raw'
import riderSrc from '../pages/RiderPwaPage.tsx?raw'

describe('R44 — Theater: ลิงก์จริง + ปุ่มตามโหมด', () => {
  it('การ์ด LEVEL 2/3: รูป+ชื่อเมนู = Link ไป /menu จริงทั้งสองการ์ด', () => {
    expect(theaterCardsSrc).toContain('data-testid="theater-rec-link"')
    expect(theaterCardsSrc).toContain('data-testid="theater-hero-link"')
    expect(theaterCardsSrc).toContain('data-testid="theater-rec-title-link"')
    expect(theaterCardsSrc).toContain('data-testid="theater-hero-title-link"')
    expect((theaterCardsSrc.match(/to="\/menu"/g) || []).length).toBeGreaterThanOrEqual(4)
  })
  it('ปุ่มแยกโหมด: พรีออเดอร์ = "📅 จองล่วงหน้า" · เซมเดย์ = "เพิ่มลงตะกร้า" คงเดิม', () => {
    expect(theaterCardsSrc).toContain('isPreOrderOnly')
    expect(theaterCardsSrc).toContain("'📅 จองล่วงหน้า'")
    expect(theaterCardsSrc).toContain('🛒 เพิ่ม')
    expect(theaterCardsSrc).toContain('ลงตะกร้า')
  })
})

describe('R44 — มุมขวา: ไม่มีปุ่มทับซ้อนกัน', () => {
  it('BiteMascot: container = ความกว้างปุ่ม (w-16) + bubble/upsell anchor absolute right-full top-1/2 (ซ้ายของมาสคอต — ระดับเดียวกัน ห้ามล้นขอบขวา)', () => {
    // R54: float อยู่ที่ container (relative w-16 animate-float) — ปุ่มเหลือ hover scale ล้วน
    expect(mascotSrc).toContain('className="relative w-16 animate-float"')
    expect(mascotSrc).toContain('absolute right-full top-1/2')
    expect(mascotSrc).toContain('data-testid="bite-bubble-stack"')
    expect(mascotSrc).toContain('max-w-[min(220px,calc(100vw-56px))]')
    // เดิม: wrapper กว้างเท่า bubble (max-w-[220px] + mr-4 ใน flow) = ต้องหายไปแล้ว
    expect(mascotSrc).not.toContain('max-w-[220px] cursor-pointer')
  })
  it('AmbientMusicToggle: ย้ายมาเป็นปุ่มใน Header ข้าง Theme Toggle แล้ว (ไม่ใช่ floating pill ซ้ายล่าง)', () => {
    // ไม่ใช้ useCartStore / clusterClear offset อีกต่อไป
    expect(musicSrc).not.toContain('useCartStore')
    expect(musicSrc).not.toContain('clusterClear')
    expect(musicSrc).not.toContain('cartCount > 0 ? 288 : 216')
    // ตัวใหม่เป็นแค่ปุ่ม ♫ ใน header
    expect(musicSrc).toContain('aria-pressed={state.playing}')
    expect(musicSrc).toContain('state.playing ?')
    expect(musicSrc).toContain('emptyBucket')
  })
})

describe('R44 — auto-print ห้ามข้ามเงียบ (Owner: ปริ้นอัตโนมัติหายไป) + ปุ่มน้ำทางยุบรวม', () => {
  it('AdminOrders: จุดข้าม auto-print ทุกจุดมี toast บอกสาเหตุ (สวิตช์ปิด/เบราว์เซอร์/โหลดไม่ได้)', () => {
    expect(adminOrdersSrc).toContain('ข้ามพิมพ์สติกเกอร์อัตโนมัติ: สวิตช์ Auto-Print ปิดอยู่')
    expect(adminOrdersSrc).toContain('ข้ามพิมพ์สติกเกอร์อัตโนมัติ: เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth')
    expect(adminOrdersSrc).toContain('ข้ามพิมพ์ใบสั่งครัวอัตโนมัติ: สวิตช์ Auto-Print ใบสั่งครัวปิดอยู่')
    // wiring เดิมคงอยู่: รับออเดอร์ = ยิงทั้งคิว (ใบสั่งครัว + สติกเกอร์ต่อคิว)
    expect(adminOrdersSrc).toMatch(/void autoPrintKitchenTicket\(orderNumber\)/)
    expect(adminOrdersSrc).toMatch(/void autoPrintStickerRoll\(orderNumber\)/)
  })
  it('RiderPwaPage: เหลือปุ่มนำทาง 2 จุด (เส้นทางรวม + จุดส่งงานนี้) — รายจุดซ้ำถูกถอด', () => {
    expect(riderSrc).toContain('data-testid="rider-open-gmaps"')
    expect(riderSrc).toContain('data-testid="rider-nav-active"')
    expect(riderSrc).not.toContain('rider-nav-stop-')
  })
})