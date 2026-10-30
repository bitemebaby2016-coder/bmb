// ============================================
// R12 (Owner 2026-10-28): หน้าแรกแถบสถานะ (คำในวงเล็บไม่ต้องแสดง) +
// กรอบโปรโมชั่นทุกกรอบขนาดเท่ากัน (รวมกรอบใหม่ในอนาคต) +
// migration 164 (anon อ่าน business_settings ทั้งหมด — Owner อนุมัติ)
// ============================================
import { describe, it, expect } from 'vitest'
import storeStatusStripSrc from '../components/home/StoreStatusStrip.tsx?raw'
import promotionStripSrc from '../components/home/PromotionStrip.tsx?raw'
import promotionsPageSrc from '../pages/PromotionsPage.tsx?raw'
import cssSrc from '../index.css?raw'
import mig164Src from '../../supabase/migrations/164_anon_read_business_settings_all.sql?raw'

describe('R12 — แถบสถานะหน้าแรก: คำในวงเล็บไม่ต้องแสดง', () => {
  it('homeProviders: ข้อความเปิดรับ = "เปิดรับออเดอร์ Same-Day / ส่งวันนี้" (ไม่มีท้าย "— ยังสั่งได้")', async () => {
    const { getStoreStatusFromRounds } = await import('@/lib/homeProviders')
    const s = getStoreStatusFromRounds([
      { status: 'active', display_name: 'SameDay', delivery_start: '06:00', delivery_end: '23:00', max_capacity: 10, current_count: 1, scheduled_date: '2026-10-14' },
    ] as never, new Date('2026-10-14T02:00:00Z'))
    expect(s.message).toBe('เปิดรับออเดอร์ Same-Day / ส่งวันนี้ : รอบส่ง ทันทีหลังครัวปรุงเสร็จ')
    expect(s.message.includes('ยังสั่งได้')).toBe(false)
    expect(s.message.includes('(')).toBe(false)
  })

  it('StoreStatusStrip: บรรทัดรายละเอียดในวงเล็บ (capacity/hours) ถอดออกแล้ว · แถบพรีออเดอร์ยังแสดง', () => {
    expect(storeStatusStripSrc).not.toContain('capacityPct')
    expect(storeStatusStripSrc).not.toContain('hoursClose')
    expect(storeStatusStripSrc).toContain('status.preOrderLine')
    expect(storeStatusStripSrc).toContain('R12 (Owner 2026-10-28)')
  })
})

describe('R12 — กรอบโปรโมชั่นทุกกรอบขนาดเท่ากัน (รวมกรอบใหม่)', () => {
  it('PromotionStrip (หน้าแรก): title/desc ถูกคลิปปิดที่ความสูงคงที่', () => {
    expect(promotionStripSrc).toContain('line-clamp-1')
    expect(promotionStripSrc).toContain('line-clamp-2')
  })
  it('PromotionsPage: ทุกการ์ดมี min-h เท่ากัน + ข้อความถูกคลิปปิด', () => {
    expect(promotionsPageSrc).toContain('min-h-[120px]')
    expect(promotionsPageSrc).toContain('line-clamp-1')
    expect(promotionsPageSrc).toContain('line-clamp-2')
  })
  it('CSS .promo-card: ความสูงคงที่ (148px) + CTA ชิดล่าง', () => {
    expect(cssSrc).toMatch(/\.promo-card \{[\s\S]*?height: 148px/)
    expect(cssSrc).toContain('min-height: 148px')
  })
})

describe('R12 — anon อ่าน business_settings ได้ทั้งหมด (Owner อนุมัติ 2026-10-28)', () => {
  it('migration 164: policy public_read = SELECT ให้ anon,authenticated ทั้งตาราง (USING true)', () => {
    expect(mig164Src).toContain('DROP POLICY IF EXISTS business_settings_public_read')
    expect(mig164Src).toContain('FOR SELECT')
    expect(mig164Src).toContain('TO anon, authenticated')
    expect(mig164Src).toContain('USING (true);')
  })
})