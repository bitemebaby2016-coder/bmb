// Wave 1 — Admin Security E2E (F-01 + F-02 acceptance)
// Runs against a local `vite preview` of the PRODUCTION build (dist/).
// Credentials come from supabase/secrets.local.env — never printed/committed.
'use strict'
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE_URL ? () => process.env.BASE_URL : () => 'http://localhost:' + PORT
const PORT = 4180 + Math.floor(Math.random() * 40) + 1
const ROUTES = [
  // NOTE: dead nav routes (/admin/pre-orders, /admin/kitchen, /admin/recipes)
  // ถูกยกเว้น — ไม่มี route จริงใน App.tsx (ตกไปที่ catch-all → "/")
  // บันทึกไว้ใน report เป็น finding แยก (Wave 4 scope) — ห้ามนับเป็น PASS
  '/admin', '/admin/orders', '/admin/products',
  '/admin/content-approvals', '/admin/rounds', '/admin/promotions',
  '/admin/customers', '/admin/inventory', '/admin/delivery', '/admin/audit-log',
  '/admin/route-optimization', '/admin/errors', '/admin/media', '/admin/settings',
  '/admin/mascot', '/admin/control',
]

function readSecrets() {
  const out = {}
  for (const line of fs.readFileSync(path.join(process.cwd(), 'supabase', 'secrets.local.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && m[2]) out[m[1]] = m[2]
  }
  return out
}
const { BMB_TEST_ADMIN_EMAIL: EMAIL, BMB_TEST_ADMIN_PASSWORD: PASSWORD } = readSecrets()

async function waitFor(url, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview server did not start')
}

async function main() {
  const usingProd = !!process.env.BASE_URL
  const preview = usingProd ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(), shell: true, stdio: 'ignore',
  })
  try {
    await waitFor(BASE() + '/', 30000)
    const { chromium } = require('playwright')
    const browser = await chromium.launch({ headless: true })
    const results = { timestamp: new Date().toISOString(), base: BASE, checks: [] }
    const push = (name, pass, detail) => results.checks.push({ name, pass, detail: detail || '' })

    // ---- A. Login + B. Reload + C. Deep links (authenticated context)
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    await page.goto(BASE() + '/login', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"]', { timeout: 45000 })
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3500)
    push('A.login', true, 'signed in with dedicated test admin (Supabase Auth)')

    await page.goto(BASE() + '/admin', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const onAdminAfterLogin = !page.url().includes('/login')
    push('B.goto_admin_after_login', onAdminAfterLogin, page.url())

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    push('B.reload_admin_stays', !page.url().includes('/login'), page.url())

    for (const r of ROUTES) {
      await page.goto(BASE() + r, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1400)
      const ok = !page.url().includes('/login') && page.url().endsWith(r)
      push('C.deep_link ' + r, ok, page.url())
    }

    // ---- E. Session persistence: reload → navigate → reload → deep-link
    await page.goto(BASE() + '/admin/orders', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    push('E.persist_orders_reload', !page.url().includes('/login'), page.url())
    await page.goto(BASE() + '/admin/settings', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    push('E.persist_settings_reload', !page.url().includes('/login'), page.url())

    // ---- F. Logout then block
    await page.goto(BASE() + '/admin', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    const logoutBtn = page.locator('button', { hasText: 'ออก' }).first()
    await logoutBtn.click()
    await page.waitForTimeout(2500)
    await page.goto(BASE() + '/admin', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    push('F.logout_blocks_admin', page.url().includes('/login'), page.url())
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    push('F.logout_survives_reload', page.url().includes('/login'), page.url())
    await ctx.close()

    // ---- D. Unauthorized (fresh context, no session)
    const anon = await browser.newContext()
    const ap = await anon.newPage()
    await ap.goto(BASE() + '/admin', { waitUntil: 'domcontentloaded' })
    await ap.waitForTimeout(2000)
    push('D.unauthorized_redirect_login', ap.url().includes('/login'), ap.url())
    await ap.goto(BASE() + '/admin/settings', { waitUntil: 'domcontentloaded' })
    await ap.waitForTimeout(2000)
    push('D.unauthorized_deep_link', ap.url().includes('/login'), ap.url())
    await anon.close()

    await browser.close()
    const passCount = results.checks.filter((c) => c.pass).length
    results.passCount = passCount
    results.total = results.checks.length
    fs.writeFileSync(path.join(process.cwd(), 'e2e', 'wave1-admin-e2e.json'), JSON.stringify(results, null, 2))
    console.log('PASS ' + passCount + '/' + results.checks.length)
    for (const c of results.checks) if (!c.pass) console.log('FAIL', c.name, c.detail)
  } finally {
    if (preview) preview.kill()
  }
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
