// Phase 3 READ-ONLY customer E2E probe — browsing + cart-localStorage only, NO orders/payments
'use strict'
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const BASE = 'https://bitemebaby-5f7.pages.dev'
const OUT = path.join(PROJ, 'e2e', 'prod-phase3-e2e.json')

async function main() {
  const ev = { timestamp: new Date().toISOString(), base: BASE, runs: [] }
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const errors = []
  async function probe(name, viewport, fn) {
    const ctx = await browser.newContext({ viewport, locale: 'th-TH' })
    const page = await ctx.newPage()
    page.on('console', (m) => { if (m.type() === 'error') errors.push({ run: name, text: m.text().slice(0, 300) }) })
    page.on('pageerror', (e) => errors.push({ run: name, pageerror: String(e).slice(0, 300) }))
    const r = { name, viewport: `${viewport.width}x${viewport.height}`, steps: [] }
    try { await fn(page, r) } catch (e) { r.fatal = String(e).slice(0, 300) }
    ev.runs.push(r)
    await ctx.close()
  }
  await probe('home-mobile', { width: 390, height: 844 }, async (page, r) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-home-mobile.png'), fullPage: false })
    r.title = await page.title()
    r.h1h2 = (await page.locator('h1,h2').allTextContents()).slice(0, 25)
    r.navLinks = (await page.locator('a[href]').evaluateAll(els => els.map(e => e.getAttribute('href')))).filter((v, i, a) => a.indexOf(v) === i).slice(0, 40)
    r.drinksSection = (await page.locator('text=เครื่องดื่ม').count()) > 0
    r.snacksSection = (await page.locator('text=ขนม').count()) > 0
  })
  await probe('menu-mobile', { width: 390, height: 844 }, async (page, r) => {
    await page.goto(BASE + '/menu', { waitUntil: 'networkidle', timeout: 45000 })
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-menu-mobile.png'), fullPage: true })
    r.items = (await page.locator('[data-testid=menu-card], .menu-card, h3').allTextContents()).slice(0, 30)
    r.preorderButtons = await page.locator('text=จองล่วงหน้า').count()
    r.sameDayButtons = await page.locator('text=วันนี้').count()
  })
  await probe('cart-flow-mobile', { width: 390, height: 844 }, async (page, r) => {
    await page.goto(BASE + '/menu', { waitUntil: 'networkidle', timeout: 45000 })
    const sameDayBtn = page.locator('[data-testid=same-day-order]').first()
    r.sameDayTestid = await page.locator('[data-testid=same-day-order]').count()
    r.preorderTestid = await page.locator('[data-testid=pre-order-btn]').count()
    if (r.sameDayTestid > 0) {
      await sameDayBtn.click({ timeout: 5000 })
      await page.waitForTimeout(1200)
      r.afterClickUrl = page.url()
      await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-after-add.png') })
      // OrderBuilder modal? try confirm/add button inside modal
      const modalAdd = page.locator('button:has-text("ใส่ตะกร้า"), button:has-text("เพิ่มลง"), button:has-text("เพิ่ม")').first()
      if (await modalAdd.count() > 0) { await modalAdd.click({ timeout: 4000 }); await page.waitForTimeout(800) }
      await page.goto(BASE + '/cart', { waitUntil: 'networkidle', timeout: 45000 })
      await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-cart.png') })
      r.cartBody = (await page.locator('body').textContent()).slice(0, 600)
      await page.reload({ waitUntil: 'networkidle' })
      r.cartBodyAfterReload = (await page.locator('body').textContent()).slice(0, 400)
      r.lsKeys = await page.evaluate(() => Object.keys(localStorage))
      await page.goto(BASE + '/checkout', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
      await page.waitForTimeout(1500)
      r.checkoutUrl = page.url()
      await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-checkout-gate.png') })
    }
  })
  await probe('track-unauth-mobile', { width: 390, height: 844 }, async (page, r) => {
    await page.goto(BASE + '/track/TEST-001', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(1500)
    r.trackUrl = page.url()
    r.trackBody = (await page.locator('body').textContent()).slice(0, 400)
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-track.png') })
    await page.goto(BASE + '/ai-chat', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(2000)
    r.aiChatBody = (await page.locator('body').textContent()).slice(0, 300)
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-ai-chat.png') })
  })
  await probe('home-desktop', { width: 1280, height: 800 }, async (page, r) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'p3-home-desktop.png') })
    r.horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
    r.installPrompt = await page.evaluate(() => !!document.querySelector('meta[name=theme-color], link[rel=manifest]'))
    r.manifestHref = await page.evaluate(() => document.querySelector('link[rel=manifest]')?.href || null)
    r.swRegistered = await page.evaluate(async () => ('serviceWorker' in navigator) ? !!(await navigator.serviceWorker.getRegistration()) : null)
  })
  ev.consoleErrors = errors.slice(0, 40)
  await browser.close()
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('PHASE3 browse probe done → ' + OUT + ' | consoleErrors=' + errors.length)
  for (const r of ev.runs) console.log('- ' + r.name + (r.fatal ? ' FATAL ' + r.fatal : ' ok'))
}
main().catch((e) => { console.error('FATAL ' + String(e).slice(0, 400)); process.exit(1) })