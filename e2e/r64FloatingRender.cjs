// R64 — production render probe: floating banner on /shop (fresh context = no dismissal)
'use strict'
const path = require('path')
;(async () => {
  const { chromium } = require('playwright')
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const out = { at: new Date().toISOString(), url: 'https://biteme-baby.com/shop' }
  try {
    await page.goto(out.url, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(3000)
    out.cards = await page.$$eval('[data-testid="floating-ad-banner"]', (els) =>
      els.map((el) => ({
        title: (el.querySelector('.flad-title')?.textContent || '').slice(0, 60),
        img: el.querySelector('.flad-media img:not(.flad-mascot-composed):not(.flad-fallback-mascot)')?.getAttribute('src') || null,
        mascot: el.querySelector('.flad-mascot-composed, .flad-fallback-mascot')?.getAttribute('src') || null,
        fallbackClass: el.querySelector('.flad-media')?.classList.contains('flad-media-fallback') || false,
      })),
    )
    out.bannerCount = out.cards.length
    out.hasHalloween = out.cards.some((c) => (c.title || '').includes('HALLOWEEN'))
    out.imageLoaded = out.cards.some((c) => c.img && c.img.includes('Hallow'))
    const shots = path.join(__dirname, 'screenshots')
    require('fs').mkdirSync(shots, { recursive: true })
    await page.screenshot({ path: path.join(shots, 'r64_floating_shop.png'), fullPage: false })
    out.shot = 'e2e/screenshots/r64_floating_shop.png'
  } finally {
    await browser.close()
  }
  require('fs').writeFileSync(path.join(__dirname, 'r64FloatingRender-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error('RENDER FAIL', e); process.exit(1) })