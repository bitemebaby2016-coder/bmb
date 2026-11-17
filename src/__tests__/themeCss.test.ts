import { describe, it, expect } from 'vitest'
// raw source ผ่าน ?raw (ต้องเปิด test.css ใน vitest.config.ts — ค่า default
// จะ mock .css เป็น string ว่าง) — ช่องทางเดียวกับ adminShell.test.ts
import indexCss from '../index.css?raw'
import homePageSrc from '../pages/HomePage.tsx?raw'

// ============================================
// Regression guard (2026-10-11): รอบธีม Graphite มีการ extend selector ของ dark
// ด้วย replace แบบ naive `html[data-theme='dark']` ->
// `html[data-theme='dark'], html[data-theme='graphite']` ทำให้ suffix (คลาส/` body`)
// ไปผูกติดแค่ branch graphite เพียงฝั่งเดียว:
// - override ของธีม dark (.bg-white/.text-black/สคริม/การ์ด) เงียบหายไป → การ์ดขาว +
//   ตัวอักษรสีเข้มบนพื้นมืด/พื้นขาวปนกัน = ธีมด่าง อ่านไม่ออก
// - declarations เหล่านั้นดันไปลงที่ <html> ทั้งตัว (cascade background/color ทับกัน)
// Guard: branch dark ต้องมี suffix เดียวกับ branch graphite เสมอ
// ============================================

describe('index.css — dark/graphite selector pair integrity', () => {
  // comment ถูก strip ก่อน เพราะข้อความใน comment มีรูป selector ปนอยู่
  const css = indexCss.replace(/\/\*[\s\S]*?\*\//g, '')

  it('never binds a class/body suffix only to the graphite branch', () => {
    const malformed = /html\[data-theme='dark'\],\s*html\[data-theme='graphite'\]\s+[^\s={]/g
    expect(css.match(malformed)).toBeNull()
  })

  it('key dark overrides still target their classes (not the bare <html> root)', () => {
    expect(css).toContain("html[data-theme='dark'] .bg-white")
    expect(css).toContain("html[data-theme='dark'] .text-black")
    expect(css).toContain("html[data-theme='dark'] .site-background__scrim")
    expect(css).toContain("html[data-theme='dark'] body")
    expect(css).toContain("html[data-theme='dark'] .fmc-media")
  })

  it('graphite keeps the same suffixes as dark on every paired rule', () => {
    const pair =
      /html\[data-theme='dark'\]([^,{\r\n]*), html\[data-theme='graphite'\]([^,{\r\n]*)/g
    let m: RegExpExecArray | null
    let checked = 0
    while ((m = pair.exec(css)) !== null) {
      // dark branch จบด้วย ',' · graphite branch จบด้วย '{' (มี space หน้า `{`) → trimEnd ก่อนเทียบ
      expect(m[2].trimEnd(), `suffix mismatch at pair #${checked}`).toBe(m[1].trimEnd())
      checked++
    }
    expect(checked).toBeGreaterThan(50) // ~65 paired rules in the dark variant block
  })
})

// ============================================
// R49 (Owner 2026-11-17) regression guard:
// 1) dark theme — ปุ่ม ✕ ปิด (flad-close/ob-close) เดิมสี #1C1917 บนพื้นเข้ม = มองไม่เห็นทุกจุด
//    → ต้องมี dark override พื้นสว่างโปร่ง + ตัวอักษรสว่าง และข้อความเตือน/คูปองต้องอ่านออก
// 2) /shop — เซกชันเธียเตอร์ซ้ำ (home-sec-bite-picks ก่อนโปรโมชั่น) ถูกถอดแล้ว ห้ามกลับมา
// ============================================
describe('R49 — dark theme close buttons + theater dedup', () => {
  // strip comment เหมือน block บน — คอมเมนต์มีสิทธิ์อ้างชื่อ id เดิมได้ (บันทึกประวัติ)
  const css = indexCss.replace(/\/\*[\s\S]*?\*\//g, '')
  const homeSrc = homePageSrc.replace(/\/\*[\s\S]*?\*\//g, '')

  it('dark/graphite ต้อง override ปุ่ม ✕ ปิดให้มองเห็น (flad-close + ob-close)', () => {
    expect(css).toContain("html[data-theme='dark'] .flad-close, html[data-theme='graphite'] .flad-close")
    expect(css).toContain("html[data-theme='dark'] .ob-close, html[data-theme='graphite'] .ob-close")
  })

  it('dark override ของปุ่ม ✕ ต้องใช้ตัวอักษรสว่าง (ไม่ใช่ #1C1917 ดำบนดำ)', () => {
    const darkClose = css.match(
      /html\[data-theme='dark'\] \.flad-close, html\[data-theme='graphite'\] \.flad-close \{[^}]*\}/,
    )
    expect(darkClose).not.toBeNull()
    expect(darkClose![0]).toMatch(/color:\s*#F5F5F5/)
    expect(darkClose![0]).not.toContain('#1C1917')
    const darkObClose = css.match(
      /html\[data-theme='dark'\] \.ob-close, html\[data-theme='graphite'\] \.ob-close \{[^}]*\}/,
    )
    expect(darkObClose).not.toBeNull()
    expect(darkObClose![0]).toMatch(/color:\s*#F5F5F5/)
    expect(darkObClose![0]).not.toContain('#1C1917')
  })

  it('dark/graphite ต้อง override ข้อความเตือนและ chip คูปองของแบนเนอร์ลอยให้อ่านออก', () => {
    const darkNotice = css.match(
      /html\[data-theme='dark'\] \.flad-notice, html\[data-theme='graphite'\] \.flad-notice \{[^}]*\}/,
    )
    expect(darkNotice).not.toBeNull()
    expect(darkNotice![0]).toMatch(/color:\s*#FBBF24/)
    expect(darkNotice![0]).not.toContain('#B45309')
    expect(css).toContain("html[data-theme='dark'] .flad-coupon, html[data-theme='graphite'] .flad-coupon")
  })

  it('/shop ห้ามมีเซกชันเธียเตอร์ซ้ำ home-sec-bite-picks ก่อนโปรโมชั่น (ถอดแล้ว — R49)', () => {
    expect(homeSrc).not.toContain('home-sec-bite-picks')
    expect(homeSrc).not.toContain('mascot-pick-accent')
    // FoodTheater ต้องยังอยู่เป็นโรงละครจุดเดียวของหน้า
    expect(homeSrc).toContain('<FoodTheater')
  })
})