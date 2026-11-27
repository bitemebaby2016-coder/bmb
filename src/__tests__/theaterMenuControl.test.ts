// ============================================
// Bite Me Baby — Theater Menu Control + flat toggle
// ============================================
import { describe, it, expect } from 'vitest'
import homeSrc from '../pages/HomePage.tsx?raw'
import controlSrc from '../components/home/TheaterMenuControl.tsx?raw'
import cssSrc from '../index.css?raw'

describe('Theater Menu Control (admin box above popular section)', () => {
  it('HomePage เรนเดอร์ control เหนือเซกชัน 🔥 เมนูยอดนิยม', () => {
    const controlIdx = homeSrc.indexOf('<TheaterMenuControl')
    const popularIdx = homeSrc.indexOf('home-sec-recommended')
    expect(controlIdx).toBeGreaterThan(-1)
    expect(popularIdx).toBeGreaterThan(-1)
    expect(controlIdx).toBeLessThan(popularIdx)
  })

  it('control เป็น admin-only + ใช้ canonical portfolio (is_theater_carousel)', () => {
    expect(controlSrc).toContain('useAuthStore')
    expect(controlSrc).toContain('ADMIN_ROLES')
    expect(controlSrc).toContain('is_theater_carousel')
    expect(controlSrc).toContain('createPortfolioItem')
    expect(controlSrc).toContain('updatePortfolioItem')
    expect(controlSrc).toContain('data-testid="theater-menu-control"')
  })
})

describe('Toggle — rectangle (ไม่ใช่วงกลม/แคปซูล) + เตี้ยที่สุด', () => {
  it('track/knob เป็นมุมโค้งแทบเหลี่ยม ไม่ใช่ 50%/999px และสูงเตี้ย', () => {
    expect(cssSrc).toContain('.bmb-toggle-track {')
    expect(cssSrc).toMatch(/\.bmb-toggle-track\s*\{[^}]*height:\s*18px/s)
    expect(cssSrc).toMatch(/\.bmb-toggle-track\s*\{[^}]*border-radius:\s*3px/s)
    expect(cssSrc).toMatch(/\.bmb-toggle-knob\s*\{[^}]*border-radius:\s*2px/s)
    expect(cssSrc).not.toMatch(/\.bmb-toggle-knob\s*\{[^}]*border-radius:\s*50%/s)
    expect(cssSrc).not.toMatch(/\.bmb-toggle-track\s*\{[^}]*border-radius:\s*999px/s)
  })
})