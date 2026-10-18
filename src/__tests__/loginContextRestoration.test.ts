// ============================================
// Bite Me Baby — Login context restoration (PRE-OPENING audit closure 2026-10-18)
// ============================================
// หน้าที่ผู้ใช้ตั้งใจ (returnTo = state.from หรือ ?next= จาก social redirect) ต้อง
// ไหลผ่าน Login ↔ Register ได้ครบ — ไม่เด้งกลับ Landing "/" โดยไม่จำเป็น
// (directive §2: "Login/Register แล้วเข้าสู่หน้าหลักตามที่กำหนด ไม่วนกลับ Landing
// โดยไม่จำเป็น" + "Cart และ Context ที่จำเป็นไม่หายระหว่าง...เข้าสู่ระบบ")
// Source invariants แบบเดียวกับ preOrderEntry.test.ts — ไม่แตะ runtime auth
// ============================================

import { describe, it, expect } from 'vitest'
import loginSrc from '../pages/login/LoginPage.tsx?raw'
import registerSrc from '../pages/login/RegisterPage.tsx?raw'

describe('returnTo plumbing — ปลายทางก่อนเข้าสู่ระบบไม่หายระหว่าง Login ↔ Register', () => {
  it('LoginPage อ่าน state.from (จาก ProtectedRoute/Checkout) + ?next= (social) เป็น returnTo', () => {
    expect(loginSrc).toContain('(routerLocation.state as { from?: string } | null)?.from')
    expect(loginSrc).toContain('readSocialNext()')
  })

  it('LoginPage ลิงก์ไป /register ต้องพก state.from ต่อไปด้วย (ไม่ใช่ลิงก์เปล่า)', () => {
    // Link ไปหน้าสมัครต้อง carry returnTo — regression: register แล้วลืมหน้าเป้าหมาย
    expect(loginSrc).toContain('to="/register"')
    expect(loginSrc).toContain('state={returnTo ? { from: returnTo } : undefined}')
  })

  it('RegisterPage อ่าน state.from + ?next= เดียวกับ LoginPage (ชุดส่งต่อเดียวกัน)', () => {
    expect(registerSrc).toContain('(routerLocation.state as { from?: string } | null)?.from')
    expect(registerSrc).toContain('readSocialNext()')
  })

  it('RegisterPage สมัครสำเร็จ → /login พร้อม state.from (ไม่ navigate เปล่า)', () => {
    expect(registerSrc).toContain(
      "navigate('/login', returnTo ? { state: { from: returnTo } } : undefined)",
    )
  })

  it('RegisterPage ลิงก์กลับ /login ก็พก state.from ด้วย (คนเปลี่ยนใจกลางคัน)', () => {
    expect(registerSrc).toContain('to="/login"')
    // Link ใช้ state={...} · navigate ใช้ { state: { from } } — ต้องมีทั้งสองจุด
    expect(registerSrc).toContain('state={returnTo ? { from: returnTo } : undefined}')
    expect(registerSrc).toContain("navigate('/login', returnTo ? { state: { from: returnTo } } : undefined)")
  })

  it('ทุกจุดส่งต่อใช้ key "from" เดียวกัน — ไม่มี key คู่ขนาน (context เดียว)', () => {
    // ProtectedRoute (App.tsx) + CheckoutPage ใช้ state { from } — หน้า login/register
    // ต้องรับ/ส่ง key เดียวกันเท่านั้น
    expect(loginSrc).not.toContain('{ redirect:')
    expect(registerSrc).not.toContain('{ redirect:')
  })
})

describe('safe fallback — ไม่มี context ก็ไม่พัง ไม่เดาทาง', () => {
  it('ไม่มี state.from → ใช้ readSocialNext() (ซึ่ง fallback "/" ปลอดภัยกัน open-redirect)', () => {
    expect(loginSrc).toMatch(/returnTo =\s*\n?\s*\(routerLocation\.state/)
    expect(registerSrc).toMatch(/returnTo =\s*\n?\s*\(routerLocation\.state/)
  })

  it('LoginPage ส่ง state เฉพาะเมื่อมี returnTo (undefined เมื่อไม่มี — ไม่สร้าง state ปลอม)', () => {
    expect(loginSrc).toContain('state={returnTo ? { from: returnTo } : undefined}')
  })
})
