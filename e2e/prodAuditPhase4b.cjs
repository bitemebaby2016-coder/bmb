// Phase 4b — SPA navigation through admin pages (click sidebar), read-only
'use strict'
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const BASE = 'https://bitemebaby-5f7.pages.dev'
const OUT = path.join(PROJ, 'e2e', 'prod-phase4b-admin-spa.json')
const DEMO = { email: 'admin@bmb.co.th', password: 'admin123' }

async function main() {
  const ev = { timestamp: new Date().toISOString(), pages: {}, navItems: null, consoleErrors: [] }
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') ev.consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => ev.consoleErrors.push('PAGEERROR ' + String(e).slice(0, 200)))

  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 45000 })
  await page.locator('input[type=email]').fill(DEMO.email)
  await page.locator('input[type=password]').fill(DEMO.password)
  await page.locator('button:has-text("เข้าสู่ระบบ"), button[type=submit]').first().click({ timeout: 5000 })
  await page.waitForTimeout(4500)
  ev.landedOn = page.url()

  // find admin nav items (sidebar links)
  const navLinks = await page.locator('a[href^="/admin"]').evaluateAll(els => els.map(e => ({ href: e.getAttribute('href'), text: e.textContent.trim().slice(0, 40) })))
  ev.navItems = navLinks
  const seen = new Set()
  for (const nl of navLinks) {
    const href = nl.href
    if (!href || seen.has(href)) continue
    seen.add(href)
    try {
      await page.locator(`a[href="${href}"]`).first().click({ timeout: 5000 })
      await page.waitForTimeout(1800)
      const body = (await page.locator('body').textContent()).slice(0, 900)
      ev.pages[href] = { url: page.url(), body: body.replace(/\s+/g, ' ').slice(0, 700) }
      await page.screenshot({ path: path.join(PROJ, 'e2e', 'p4b-' + href.replaceAll('/', '_') + '.png') })
    } catch (e) { ev.pages[href] = { fatal: String(e).slice(0, 200) } }
  }
  await browser.close()
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('PHASE4b done | landed=' + ev.landedOn + ' | navItems=' + navLinks.length)
}
main().catch((e) => { console.error('FATAL ' + String(e).slice(0, 400)); process.exit(1) })