// ============================================
// Bite Me Baby — Theater/Waiting Stage unity + Theater on/off (directive §2)
// ============================================
// ปิดงานค้าง PRE-OPENING audit (2026-10-18):
//   1) Talk to Bite × AI Waiter Stage × Theater = ประสบการณ์เดียวกัน — มาสคอต
//      บนเวทีเปิด TalkToBite overlay ตัวเดียวกับ Floating Bite (openChat)
//   2) "เปิด/ปิด Theater ได้ และยังเลือกซื้อผ่านหน้าร้านปกติได้" — toggle แบบ
//      preference รายเครื่อง + ทางเข้า /menu คงอยู่ทั้งสองสถานะ
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readTheaterOpen, writeTheaterOpen, THEATER_OPEN_KEY } from '@/lib/theaterPreferences'
import foodTheaterSrc from '../components/theater/FoodTheater.tsx?raw'

describe('theaterPreferences — เปิด/ปิด Theater (preference รายเครื่อง, default เปิด)', () => {
  beforeEach(() => localStorage.removeItem(THEATER_OPEN_KEY))
  afterEach(() => localStorage.clear())

  it('ยังไม่เคยตั้งค่า → เปิดอยู่ (true) — ประสบการณ์ Theater เป็นค่าเริ่มต้น', () => {
    expect(readTheaterOpen()).toBe(true)
  })

  it('บันทึกแล้วอ่านคืนได้ทั้งสองสถานะ', () => {
    writeTheaterOpen(false)
    expect(readTheaterOpen()).toBe(false)
    writeTheaterOpen(true)
    expect(readTheaterOpen()).toBe(true)
  })

  it('ค่าที่เก็บเป็น token สั้น ไม่ใช่ JSON ซับซ้อน (อ่านง่าย/กันพัง)', () => {
    writeTheaterOpen(false)
    expect(localStorage.getItem(THEATER_OPEN_KEY)).toBe('0')
    writeTheaterOpen(true)
    expect(localStorage.getItem(THEATER_OPEN_KEY)).toBe('1')
  })

  it('ค่าแปลก/เสียใน storage → ไม่ throw, fallback = เปิด', () => {
    localStorage.setItem(THEATER_OPEN_KEY, 'banana')
    expect(readTheaterOpen()).toBe(true)
  })

  it('localStorage โยน error → ไม่พังทั้งอ่าน/เขียน (private mode)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readTheaterOpen()).toBe(true)
    expect(() => writeTheaterOpen(false)).not.toThrow()
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('FoodTheater source invariants — unity + toggle + หน้าร้านปกติ', () => {
  it('มาสคอตบนเวที (ทั้ง empty state และ stage floor) = ปุ่มเปิด Talk to Bite ชุดเดียว', () => {
    // สองจุดบนเวทีเรียก chatWithBite → openChat — ไม่ใช่ภาพตกแต่งเฉย ๆ
    const chatButtons = foodTheaterSrc.match(/onClick=\{chatWithBite\}/g) || []
    expect(chatButtons.length).toBeGreaterThanOrEqual(2)
    expect(foodTheaterSrc).toContain('data-testid="theater-mascot-chat"')
    // unity จริง = ยิงผ่าน openChat ของ useBiteAIStore (overlay ตัวเดียวกับ Floating Bite)
    expect(foodTheaterSrc).toContain("useBiteAIStore((s) => s.openChat)")
    expect(foodTheaterSrc).toContain('openChat(context)')
  })

  it('บริบทที่ส่งเข้าแชต = สถานะจริง (route + ตะกร้า) — ไม่แต่งข้อมูล', () => {
    expect(foodTheaterSrc).toContain('ลูกค้าอยู่หน้า /shop (Bite Food Theater)')
    expect(foodTheaterSrc).toContain('มีของในตะกร้า ${count} รายการ')
  })

  it('มีปุ่มเปิด/ปิด Theater + บันทึก preference ทุกครั้งที่สลับ', () => {
    expect(foodTheaterSrc).toContain('data-testid="theater-toggle"')
    expect(foodTheaterSrc).toContain('data-testid="theater-reopen"')
    expect(foodTheaterSrc).toContain('writeTheaterOpen(')
    expect(foodTheaterSrc).toContain('aria-expanded={theaterOpen}')
  })

  it('สถานะปิด Theater → ยังเข้าหน้าร้านปกติได้ (/menu) และส่วนร้านด้านล่างไม่หาย', () => {
    expect(foodTheaterSrc).toContain('data-testid="theater-closed"')
    expect(foodTheaterSrc).toContain('data-testid="theater-closed-menu"')
    expect(foodTheaterSrc).toContain("navigate('/menu')")
    // section หลักต้อง mount เสมอ (shopRoute contract: data-testid="food-theater")
    expect(foodTheaterSrc).toContain('data-testid="food-theater"')
  })

  it('toggle ไม่แตะ cart/ราคา/คำสั่งซื้อ — เป็น view state ล้วน (ไม่มี business authority)', () => {
    // ฟังก์ชัน toggle ใช้ได้เฉพาะ writeTheaterOpen + setTheaterOpen เท่านั้น
    expect(foodTheaterSrc).toContain('function toggleTheater()')
    const fnBlock = foodTheaterSrc.slice(
      foodTheaterSrc.indexOf('function toggleTheater()'),
      foodTheaterSrc.indexOf('function chatWithBite()'),
    )
    expect(fnBlock).toContain('writeTheaterOpen(')
    expect(fnBlock).not.toContain('clearCart')
    expect(fnBlock).not.toContain('create_order')
    expect(fnBlock).not.toContain('addItem')
  })
})
