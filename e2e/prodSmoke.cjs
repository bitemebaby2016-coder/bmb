// Bite Me Baby — Production smoke test (Playwright)
const fs = require('fs')
const path = require('path')
const { chromium } = require('D:/selfprint-v3-react/node_modules/playwright')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const URL = 'https://bitemebaby-5f7.pages.dev'
;(async () => {
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, ignoreHTTPSErrors: true })
    const page = await ctx.newPage()
    const consoleErrors = []
    page.on('console', (m) => { if (m.type === 'error') consoleErrors.push(m.text.slice(0, 160)) })
    page.on('pageerror', (e) => consoleErrors.push('pageerror:' + String(e).slice(0, 160)))

    const t0 = Date.now()
    let respInfo = null
    page.on('response', (res) => { const u = String(typeof res.url === 'function' ? res.url() : res.url); if (u.includes(URL)) respInfo = u })
    page.on('request', (req) => { const u = String(typeof req.url === 'function' ? req.url() : req.url); if (u.includes(URL)) console.log('REQ>', u.slice(0, 120), req.resourceType) })
    await page.goto(URL + '/', { waitUntil: 'commit', timeout: 45000 })
    await page.waitForTimeout(2500)
    console.log('AFTER_GOTO url=', String(await page.evaluate(() => location.href)).slice(0, 180), 'readyState=', await page.evaluate(() => document.readyState), 'resp=', String(respInfo).slice(0, 160))
    const html = await page.content()
    console.log('HTML_SNIP>', html.slice(0, 260))
    await page.waitForSelector('[data-testid="home-menu-cta"]', { timeout: 20000 })
    const loadMs = Date.now() - t0
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'screenshots', 'prod-home.png'), fullPage: false })
    const mascots = await page.locator('img.mascot-badge').count()
    const title = await page.title()

    await page.click('[data-testid="home-menu-cta"]')
    await page.waitForSelector('[data-testid="same-day-tab"]', { timeout: 20000 })
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'screenshots', 'prod-menu.png'), fullPage: false })
    const menuOk = await page.locator('[data-testid="same-day-order"]').count()

    const result = {
      url: URL,
      timestamp: new Date().toISOString(),
      title,
      loadMs,
      heroMascots: mascots,
      menuCards: menuOk,
      consoleErrors,
      pass: mascots >= 2 && menuOk > 0 && consoleErrors.length === 0,
    }
    fs.writeFileSync(path.join(PROJ, 'e2e', 'prod-smoke.json'), JSON.stringify(result, null, 2), 'utf8')
    console.log(JSON.stringify(result))
    process.exit(result.pass ? 0 : 1)
  } catch (e) {
    let bodytxt = '', htmlHead = ''
    try {
      bodytxt = String(await page.locator('body').textContent()).slice(0, 500)
      htmlHead = String(await page.content()).slice(0, 260)
    } catch {}
    console.log('SMOKE_ERROR', String(e).slice(0, 600))
    console.log('CONSOLE_ERRORS>', JSON.stringify(consoleErrors))
    console.log('BODY>', bodytxt)
    fs.writeFileSync(path.join(PROJ, 'e2e', 'prod-smoke.json'), JSON.stringify({ url: URL, pass: false, fatal: String(e).slice(0, 400), consoleErrors, body: bodytxt, htmlHead }, null, 2), 'utf8')
    process.exit(1)
  } finally {
    try { if (browser) await browser.close() } catch {}
  }
})()