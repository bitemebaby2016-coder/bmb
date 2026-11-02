// R56 — วัดว่าแบบฟอร์มสติกเกอร์ใหม่ "พอดี" ใบ 38.4×58.4mm จริงในเบราว์เซอร์ (ไม่ถูก overflow ตัด)
// evidence → e2e/r56_measure_result.json
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const ROOT = path.resolve(__dirname, '..')

const measure = async (page, file) => {
  const html = fs.readFileSync(path.join(ROOT, 'e2e', file), 'utf8')
  await page.setContent(html, { waitUntil: 'load' })
  return await page.evaluate(() => {
    const s = document.querySelector('.sheet')
    const wrap = document.querySelector('.qrwrap')
    const scan = document.querySelector('.scan')
    const ty = document.querySelector('.ty')
    const sr = s.getBoundingClientRect()
    const wr = wrap.getBoundingClientRect()
    // ทุกแถวเนื้อหา (ทุกอย่างนอกจาก qrwrap) ต้องไม่ชนกันเอง
    const kids = [...s.children].filter((el) => !el.classList.contains('qrwrap'))
    const lastKidBottom = Math.max(...kids.map((el) => el.getBoundingClientRect().bottom - sr.top))
    return {
      sheetClientH: Math.round(sr.height),
      sheetScrollH: s.scrollHeight,          // > clientH = ถูก overflow ตัด
      qrwrapTop: Math.round(wr.top - sr.top),
      qrwrapBottom: Math.round(wr.bottom - sr.top),
      lastContentBottom: Math.round(lastKidBottom), // เนื้อบนจบตรงไหน (ก่อนช่องว่าง → QR)
      scanVisible: scan.getBoundingClientRect().bottom <= sr.bottom + 0.5,
      tyVisible: ty.getBoundingClientRect().bottom <= sr.bottom + 0.5,
      qrVisible: wr.bottom <= sr.bottom + 0.5,
      contentOverlapsQr: lastKidBottom > (wr.top - sr.top) + 0.5,
    }
  })
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 3 })
  const out = {
    at: new Date().toISOString(),
    oneItem: await measure(page, 'r56_sticker_one.html'),
    eightItems: await measure(page, 'r56_sticker_many.html'),
  }
  const ok = (m) => m.sheetScrollH <= m.sheetClientH && m.qrVisible && m.scanVisible && m.tyVisible && !m.contentOverlapsQr
  out.ALL_PASS = ok(out.oneItem) && ok(out.eightItems)
  await browser.close()
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r56_measure_result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('MEASURE_FAILED', String(e).slice(0, 300)); process.exit(1) })
