// ============================================
// W-4 / L-1 + L-2 — ห้ามโชว์ข้อความเชิงเทคนิค/ป้ายอังกฤษที่ Owner สั่งห้าม (N-4 ข้อ 1-2)
//   L-1: ป้าย "BITE · AI WAITER STAGE" ห้ามเห็น → เริ่ม "เมนูพร้อมขายวันนี้" · ไทยธรรมชาติ 100%
//   L-2: ป้าย "(Marketing Testimonials)" ห้ามเห็น → หัวข้อเสียงชมแบบธรรมชาติ
// ============================================

import { describe, it, expect } from 'vitest'
import { THEATER_EDITORIAL_DEFAULTS, resolveTheaterEditorial } from '@/lib/theaterEditorial'
import theaterEditorialSrc from '../lib/theaterEditorial.ts?raw'
import reviewCarouselSrc from '../components/home/ReviewCarouselSection.tsx?raw'
import reviewPageSrc from '../pages/ReviewPage.tsx?raw'

describe('L-1 — หัวข้อ theater ไม่ใช่ป้ายเชิงเทคนิค', () => {
  it('ค่าเริ่มต้น = "เมนูพร้อมขายวันนี้" และไม่มีสตริง BITE · AI WAITER STAGE ในโค้ดค่าเริ่มต้น', () => {
    expect(THEATER_EDITORIAL_DEFAULTS.kicker).toBe('เมนูพร้อมขายวันนี้')
    expect(theaterEditorialSrc).not.toMatch(/kicker:\s*'BITE · AI WAITER STAGE'/)
  })

  it('admin เก่าตั้งค่า kicker เป็นป้ายเทคนิคไว้ใน business_settings → ยังถูกบังคับเป็นค่าไทยธรรมชาติ', () => {
    expect(resolveTheaterEditorial({ kicker: 'BITE · AI WAITER STAGE' }).kicker).toBe('เมนูพร้อมขายวันนี้')
    expect(resolveTheaterEditorial({ kicker: 'bite · ai waiter stage' }).kicker).toBe('เมนูพร้อมขายวันนี้')
    expect(resolveTheaterEditorial({ kicker: '   ' }).kicker).toBe('เมนูพร้อมขายวันนี้')
    // หัวข้อที่แอดมินตั้งเอง (ไม่ใช่ป้ายเทคนิค) ยังคงแสดงตามเดิม
    expect(resolveTheaterEditorial({ kicker: 'วันนี้ที่ร้าน' }).kicker).toBe('วันนี้ที่ร้าน')
  })
})

describe('L-2 — ป้าย (Marketing Testimonials) ห้ามแสดง', () => {
  it('ReviewCarouselSection ไม่มีสตริง (Marketing Testimonials) แล้ว', () => {
    expect(reviewCarouselSrc).not.toContain('(Marketing Testimonials)')
    expect(reviewCarouselSrc).toContain('เสียงชมจากผู้ชม')
  })

  it('ReviewPage หัวข้อ = ภาษาไทยธรรมชาติ ไม่ใช่ Marketing Testimonials', () => {
    expect(reviewPageSrc).not.toContain('>Marketing Testimonials<')
    expect(reviewPageSrc).toContain('เสียงชมจากผู้ชม')
  })
})