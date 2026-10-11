import { describe, it, expect } from 'vitest'
// raw source ผ่าน ?raw (ต้องเปิด test.css ใน vitest.config.ts — ค่า default
// จะ mock .css เป็น string ว่าง) — ช่องทางเดียวกับ adminShell.test.ts
import indexCss from '../index.css?raw'

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