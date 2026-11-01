// ============================================
// Bite Me Baby — R44 UI (Owner 2026-11-01)
//   ① Theater: การ์ดเมนูลิงก์จริงไป /menu + ปุ่มตามโหมด (พรีออเดอร์ = จองล่วงหน้า)
//   ② มุมขวา: bubble มาสคอต anchor เบ้นอกขอบจอ + music pill ไม่ทับ cluster (ยุบทับซ้อน)
// ============================================

import { describe, it, expect } from 'vitest'
import theaterCardsSrc from '../components/theater/TheaterCards.tsx?raw'
import mascotSrc from '../components/ai/BiteMascot.tsx?raw'
import musicSrc from '../components/audio/AmbientMusicToggle.tsx?raw'

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
  it('BiteMascot: container = ความกว้างปุ่ม (w-16) + bubble/upsell anchor absolute bottom-full right-0 (เบนเข้าจอกลาง — ห้ามล้นขอบขวา)', () => {
    expect(mascotSrc).toContain('className="relative w-16"')
    expect(mascotSrc).toContain('absolute bottom-full right-0')
    expect(mascotSrc).toContain('data-testid="bite-bubble-stack"')
    expect(mascotSrc).toContain('max-w-[min(220px,calc(100vw-56px))]')
    // เดิม: wrapper กว้างเท่า bubble (max-w-[220px] + mr-4 ใน flow) = ต้องหายไปแล้ว
    expect(mascotSrc).not.toContain('max-w-[220px] cursor-pointer')
  })
  it('AmbientMusicToggle: offset คำนวณตาม cluster ที่แท้จริง (มีของ=288 · ว่าง=216) ไม่ใช่ 168 ตายตัว', () => {
    expect(musicSrc).toContain('useCartStore')
    expect(musicSrc).toContain('clusterClear')
    expect(musicSrc).toContain('cartCount > 0 ? 288 : 216')
    expect(musicSrc).not.toContain('+ 168px)')
  })
})