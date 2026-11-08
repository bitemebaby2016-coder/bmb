// R77 (Owner 2026-11-07): ① ปุ่มปิดป๊อปอัพ + ปุ่มเปิดภายนอกต้องไม่ error
// ② use my location จากลิงก์เฟซ = บอกทางออก + พาไปปักหมุด
// ③ เมนูพรีออเดอร์เลยรอบไม่โชว์ (รวมเมนูยอดนิยม) + แท็บ 7 วันที่มีเมนู · ไม่มีรอบ = กฎ "ยังไม่ลงปฏิทิน" เดิม
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { isPreOrderDayPassed, pickNextScheduleDates } from '@/lib/productSchedule'
import type { RoundTimeInfo } from '@/lib/deliveryRoundStatus'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const noticeSrc = read('src/components/layout/InAppBrowserNotice.tsx')
const checkoutSrc = read('src/pages/CheckoutPage.tsx')
const menuSrc = read('src/pages/MenuPage.tsx')
const locSrc = read('src/lib/locationLogin.ts')

describe('R77 ① — ป๊อปอัพเปิดเบราว์เซอร์ภายนอก: ปุ่มปิด + ปุ่มต้องไม่ error', () => {
  it('ปุ่มปิด (X) จำการปิดต่อแท็บ + R81: ไม่มีปุ่ม intent บน UI (ลบแล้ว — ห้าม window.open/intent nav)', () => {
    expect(noticeSrc).toContain('data-testid="inapp-close"')
    expect(noticeSrc).toContain('NOTICE_DISMISS_KEY')
    expect(noticeSrc).not.toContain('href={intentUrl}')
    expect(noticeSrc).not.toContain('window.open(intent')
    expect(noticeSrc).not.toContain('window.location.replace(intent)')
    // ห้ามยิง intent อัตโนมัติตอนโหลดหน้า (กันหน้า error เด้งเอง)
    expect(noticeSrc).not.toContain('openIntentSafely')
    expect(noticeSrc).not.toContain('EXT_REDIRECT_KEY')
    // R81-B5: in-app = ซ่อนปุ่ม GPS (กดแล้ว error = อาการ Owner) + ทางออก = แผนที่/ค้นหา
    expect(checkoutSrc).toContain('{!isInApp && (')
    expect(checkoutSrc).toContain('พิมพ์ค้นหาที่อยู่')
  })
})

describe('R77 ② — use my location จากลิงก์เฟซ: บอกทางออก + พาไปปักหมุด', () => {
  it('CheckoutPage: แยกกรณี in-app browser + เลื่อนลงแผนที่ปักหมุด', () => {
    expect(checkoutSrc).toContain('isInAppBrowser(navigator.userAgent)')
    expect(checkoutSrc).toContain("getElementById('checkout-map-picker')")
    expect(checkoutSrc).toContain('id="checkout-map-picker"')
    expect(checkoutSrc).toContain('เบราว์เซอร์ของ Facebook ใช้ GPS ไม่ได้')
  })
  it('getTrustedGpsLocation: timeout 25s (GPS cold fix มือถือเกิน 10s ได้)', () => {
    expect(locSrc).toContain('getTrustedGpsLocation(timeoutMs = 25_000)')
  })
})

describe('R77 ③ — เมนูพรีออเดอร์เลยรอบไม่โชว์ + 7 วันที่มีเมนู', () => {
  const round = (over: Partial<RoundTimeInfo> = {}): RoundTimeInfo => ({
    cutoff_time: '10:30', pre_order_cutoff: null, delivery_start: '11:00', delivery_end: '14:00', ...over,
  })
  const TODAY = '2026-11-07'
  // เวลา "ตอนนี้" แบบ BKK ตรึง (UTC+7) — deterministic ทุกเครื่อง
  const nowAt = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return Date.UTC(2026, 10, 7, h - 7, m)
  }

  it('isPreOrderDayPassed: วันก่อนวันนี้ = passed · วันถัดไป = ไม่ passed', () => {
    expect(isPreOrderDayPassed('2026-11-06', [], { today: TODAY })).toBe(true)
    expect(isPreOrderDayPassed('2026-11-08', [], { today: TODAY })).toBe(false)
  })

  it('วันนี้: ไม่มีรอบส่ง = passed (ไปอยู่กฎ "ยังไม้ลงปฏิทิน" เดิม) · รอบยังไม่เลย = ไม่ passed', () => {
    expect(isPreOrderDayPassed(TODAY, [], { today: TODAY })).toBe(true)
    expect(isPreOrderDayPassed(TODAY, [round()], { today: TODAY, nowUtcMs: nowAt('09:00') })).toBe(false)
  })

  it('วันนี้: เลยรอบทุกรอบ = passed · ยังเหลือรอบไม่เลย = ไม่ passed', () => {
    // 15:30 BKK: รอบ 11:00-14:00 (ปิดรับ 09:00 = delivery_start − 2 ชม.) = เลยแล้วทั้งคู่
    expect(isPreOrderDayPassed(TODAY, [round()], { today: TODAY, nowUtcMs: nowAt('15:30') })).toBe(true)
    // 15:30 BKK แต่ยังมีรอบเย็น pre_order_cutoff 16:00 = ยังไม่เลย → วันยังเปิด
    expect(
      isPreOrderDayPassed(TODAY, [round(), round({ pre_order_cutoff: '16:00', delivery_start: '17:00', delivery_end: '20:00' })],
        { today: TODAY, nowUtcMs: nowAt('15:30') }),
    ).toBe(false)
  })

  it('pickNextScheduleDates: todayPassed = ข้ามวันนี้ (เมนูวนไปวันถัดไป · เหลือแต่เลยรอบ = ไม่โชว์)', () => {
    const rows = [
      { product_id: 'a', scheduled_date: TODAY, is_published: true },
      { product_id: 'a', scheduled_date: '2026-11-09', is_published: true },
      { product_id: 'b', scheduled_date: TODAY, is_published: true },
    ]
    expect(pickNextScheduleDates(rows, TODAY)).toEqual({ a: TODAY, b: TODAY })
    expect(pickNextScheduleDates(rows, TODAY, { todayPassed: true })).toEqual({ a: '2026-11-09' })
  })

  it('MenuPage: แถบ 7 วันเมนู (สูงสุด 7) + กรองตามวันที่เลือก', () => {
    expect(menuSrc).toContain('data-testid="preorder-day-strip"')
    expect(menuSrc).toContain('data-testid="preorder-day-chip"')
    expect(menuSrc).toContain('.slice(0, 7)')
    expect(menuSrc).toContain('scheduleMap[p.id] !== activeDay')
    expect(menuSrc).toContain('formatThaiDate(d)')
  })

  it('เมนูยอดนิยม: พรีออเดอร์ไม่มีวันใน map (เลยรอบ/ยังไม่ลงปฏิทิน) = ไม่โชว์ (กฎ R34 เดิม)', () => {
    const homePopularSrc = read('src/lib/homePopular.ts')
    expect(homePopularSrc).toContain("productModeOf(p) === 'pre-order' && !schedule[p.id]")
  })
})