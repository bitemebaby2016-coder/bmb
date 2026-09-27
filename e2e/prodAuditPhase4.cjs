// Phase 4 READ-ONLY admin audit — login (demo creds) + browse only, NO mutations
'use strict'
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const BASE = 'https://bitemebaby-5f7.pages.dev'
const OUT = path.join(PROJ, 'e2e', 'prod-phase4-admin.json')
const DEMO = { email: 'admin@bmb.co.th', password: 'admin123' }

async function main() {
  const ev = { timestamp: new Date().toISOString(), base: BASE, login: null, pages: {}, consoleErrors: [] }
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') ev.consoleErrors.push(m.text().slice(0, 250)) })
  page.on('pageerror', (e) => ev.consoleErrors.push('PAGEERROR ' + String(e).slice(0, 250)))

  // 1. login attempt with PUBLIC demo creds (as displayed on /login)
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 45000 })
  await page.screenshot({ path: path.join(PROJ, 'e2e', 'p4-login.png') })
  await page.locator('input[type=email]').fill(DEMO.email)
  await page.locator('input[type=password]').fill(DEMO.password)
  await Promise.race([
    (async () => {
      await page.locator('button:has-text("เข้าสู่ระบบ"), button[type=submit]').first().click({ timeout: 5000 })
      await page.waitForTimeout(4000)
    })(),
    page.waitForTimeout(9000),
  ])
  ev.login = { url: page.url(), body: (await page.locator('body').textContent()).slice(0, 300) }
  await page.screenshot({ path: path.join(PROJ, 'e2e', 'p4-after-login.png') })
  const loggedIn = page.url().includes('/admin') || !(await page.locator('input[type=password]').count())

  // 2. unauthenticated direct access check (separate clean context)
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p2 = await ctx2.newPage()
  await p2.goto(BASE + '/admin', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  await p2.waitForTimeout(2000)
  ev.unauthAdmin = { url: p2.url(), hasPassword: (await p2.locator('input[type=password]').count()) > 0 }
  await p2.screenshot({ path: path.join(PROJ, 'e2e', 'p4-unauth-admin.png') })
  await ctx2.close()

  // 3. browse admin pages (read-only) if logged in
  const PAGES = ['/admin', '/admin/orders', '/admin/products', '/admin/rounds', '/admin/customers', '/admin/settings', '/admin/delivery', '/admin/inventory', '/admin/promotions', '/admin/media', '/admin/audit-log', '/admin/control', '/admin/route-optimization', '/admin/content-approvals', '/admin/mascot', '/admin/errors']
  if (loggedIn) {
    for (const r of PAGES) {
      try {
        await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 45000 })
        await page.waitForTimeout(1500)
        ev.pages[r] = {
          url: page.url(),
          redirected: page.url() !== BASE + r,
          body: (await page.locator('body').textContent()).slice(0, 500),
        }
        await page.screenshot({ path: path.join(PROJ, 'e2e', 'p4-' + r.replaceAll('/', '_') + '.png') })
      } catch (e) { ev.pages[r] = { fatal: String(e).slice(0, 200) } }
    }
  }
  await browser.close()
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('PHASE4 admin probe done | loggedIn=' + loggedIn + ' | errors=' + ev.consoleErrors.length)
}
main().catch((e) => { console.error('FATAL ' + String(e).slice(0, 400)); process.exit(1) })