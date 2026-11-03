'use strict'
// diagnostic: /shop (anon = ฝั่งลูกค้าจริง) การ์ดโปรโมชั่น (is_banner) ไม่ขึ้นแม้ DB มีแถว?
// จับ response /rest/v1/promotions จริง + การ์ดที่แสดง + dismissed keys
const path = require('path')
const OUT = path.join(__dirname, 'r61HomeDiag-result.json')
;(async () => {
  const { chromium } = require('playwright')
  const out = { at: new Date().toISOString() }
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    out.promoResponses = []
    page.on('response', async (r) => {
      if (r.url().includes('/rest/v1/promotions')) {
        let rows = null
        try { rows = await r.json() } catch { /* */ }
        out.promoResponses.push({
          status: r.status(),
          url: r.url().slice(-90),
          count: Array.isArray(rows) ? rows.length : null,
          sample: Array.isArray(rows) && rows[0] ? { id: rows[0].id, is_banner: rows[0].is_banner, is_active: rows[0].is_active } : rows,
        })
      }
    })
    page.on('requestfailed', (r) => { if (r.url().includes('promotions')) out.promoFail = String(r.failure() && r.failure().errorText) })
    await page.goto('https://biteme-baby.com/shop', { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(8000)
    out.cards = await page.locator('[data-testid="floating-ad-banner"] .flad-title').allInnerTexts().catch(() => [])
    out.hasOverlay = (await page.locator('[data-testid="floating-ad-banners"]').count()) > 0
    out.restDirect = await page.evaluate(async () => {
      const r = await fetch('https://ivkdfognyiwjcmrhcnwz.supabase.co/rest/v1/promotions?select=id,name,is_banner,is_active&is_banner=eq.true', {
        headers: { apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' },
      })
      return { status: r.status, rows: (await r.json()).map((x) => ({ id: x.id, active: x.is_active })) }
    }).catch((e) => 'ERR ' + e.message)
    out.dismissedKeys = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('bmb_banner_dismiss')))
    // กดปิดการ์ดทั้งหมด → ดูว่าโปรโมชั่น (is_banner) ลอยขึ้นมาแทนไหม
    let closeN = await page.locator('[data-testid="floating-ad-close"]').count()
    let guard = 0
    while (closeN > 0 && guard < 4) {
      await page.locator('[data-testid="floating-ad-close"]').first().click().catch(() => {})
      await page.waitForTimeout(400)
      closeN = await page.locator('[data-testid="floating-ad-close"]').count()
      guard++
    }
    await page.waitForTimeout(3000)
    out.cardsAfterDismiss = await page.locator('[data-testid="floating-ad-banner"] .flad-title').allInnerTexts().catch(() => [])
    out.dismissedKeys2 = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('bmb_banner_dismiss')))
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'tHomeDiag.png') })
    await browser.close()
  } catch (e) { out.error = String(e && e.message || e); try { await browser.close() } catch { /* */ } }
  require('fs').writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ cards: out.cards, overlay: out.hasOverlay, promoResponses: out.promoResponses, rest: out.restDirect, fail: out.promoFail || null, dismissed: out.dismissedKeys }))
})().catch((e) => { console.error('DIAG_FAIL ' + String(e).slice(0, 300)); process.exit(1) })
