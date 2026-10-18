// ============================================
// Bite Me Baby — Route reachability smoke (closure 2026-10-18)
// เปิดทุก route สำคัญบน build จริง (vite preview) + ตรวจ guard/redirect/catch-all
// + console errors ("No routes matched location" = broken registry)
// ============================================

import { test, expect, type Page } from '@playwright/test'

interface RouteCase {
  path: string
  /** ปลายทางหลัง guard/redirect (ไม่ระบุ = ต้องอยู่ที่ path เดิม) */
  expectPath?: string
}

const ROUTES: RouteCase[] = [
  // Public customer journey
  { path: '/' },
  { path: '/shop' },
  { path: '/menu' },
  { path: '/cart' },
  { path: '/checkout' },
  { path: '/promotions' },
  { path: '/reviews' },
  { path: '/track' },
  { path: '/track/BMB-TEST-0001' },
  { path: '/payment/BMB-TEST-0001' },
  { path: '/login' },
  { path: '/register' },
  { path: '/reset-password' },
  { path: '/talk-to-bite' },
  { path: '/ai-chat', expectPath: '/talk-to-bite' },
  // Info pages
  { path: '/about' },
  { path: '/faq' },
  { path: '/blog' },
  { path: '/contact' },
  { path: '/privacy' },
  { path: '/terms' },
  { path: '/vote' },
  { path: '/random-menu' },
  { path: '/share' },
  { path: '/rider' },
  // Protected (guest → /login)
  { path: '/orders', expectPath: '/login' },
  { path: '/profile', expectPath: '/login' },
  { path: '/notifications', expectPath: '/login' },
  { path: '/rewards', expectPath: '/login' },
  { path: '/viral', expectPath: '/login' },
  { path: '/voice-demo', expectPath: '/login' },
  { path: '/profile/orders', expectPath: '/login' },
  // Admin (guest → /login; redirect ตั้งใจของ pre-orders ก็จบที่ /login)
  { path: '/admin', expectPath: '/login' },
  { path: '/admin/orders', expectPath: '/login' },
  { path: '/admin/pre-orders', expectPath: '/login' },
  { path: '/admin/delivery', expectPath: '/login' },
  // Catch-all → '/' (รวม route ที่เคยมีลิงก์ตาย)
  { path: '/blog/post-1', expectPath: '/' },
  { path: '/admin/dashboard', expectPath: '/' },
  { path: '/no-such-page-xyz', expectPath: '/' },
]

function watchPage(page: Page, errors: string[]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
}

for (const route of ROUTES) {
  test(`route reachable: ${route.path}`, async ({ page }) => {
    const errors: string[] = []
    watchPage(page, errors)
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    // SPA: #root ต้อง render จริง (ไม่ใช่หน้าว่าง)
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 })
    // guard/redirect: ปล่อย React Router ตัดสิน แล้วตรวจปลายทาง
    const expected = route.expectPath ?? route.path
    if (route.expectPath) {
      await page.waitForURL((url) => url.pathname === route.expectPath, { timeout: 15_000 })
    } else {
      await expect(page).toHaveURL((url) => url.pathname === expected, { timeout: 15_000 })
    }
    // ไม่มี route registry error / unhandled crash
    const bad = errors.filter(
      (e) => e.includes('No routes matched location') || e.includes('Minified React error'),
    )
    expect(bad, `console errors: ${bad.join(' | ')}`).toEqual([])
  })
}