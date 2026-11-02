// e2e/r55_compare_px.cjs — render โลโก้ทุกตัวขนาดแสดงผลจริง (footer 24px · review badge 15px)
// ข้างกัน แล้ว screenshot เป็นหลักฐานไว้ตัดสินใจ normalize (ขั้นตอน R55 ที่ 3)
const path = require('path')
const fs = require('fs')
const http = require('http')
const { chromium } = require('playwright')

const PUBLIC = path.resolve(__dirname, '..', 'public')
const FILES = [
  'FB logo.webp',
  'Grab Food Logo.webp',
  'line logo.webp',
  'Messenger logo.webp',
  'Facebook Logo.webp',
]
const OUT_PNG = path.resolve(__dirname, 'r55_compare_px.png')

function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const name = decodeURIComponent(req.url.replace(/^\//, ''))
      if (!FILES.includes(name)) return res.writeHead(404).end('nope')
      res.writeHead(200, { 'Content-Type': 'image/webp' }).end(fs.readFileSync(path.join(PUBLIC, name)))
    })
    server.on('error', reject)
    server.listen(8923, '127.0.0.1', () => resolve(server))
  })
}

async function main() {
  const server = await serve()
  const base = `http://127.0.0.1:8923`
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 760, height: 520 }, deviceScaleFactor: 4 })

  const urls = FILES.map((f) => ({ name: f, url: `${base}/${encodeURIComponent(f)}` }))
  const cell = (u, px) =>
    `<span style="display:inline-flex;align-items:center;justify-content:center;width:${px + 8}px;height:${px + 8}px;border:1px dashed #bbb;background:#fff">
       <img src="${u.url}" style="width:${px}px;height:${px}px;object-fit:contain" />
     </span>`

  const rows = urls
    .map(
      (u) => `<div style="display:flex;align-items:center;gap:14px;margin:6px 0;font:13px sans-serif">
        <div style="width:170px">${u.name}</div>
        ${cell(u, 24)}${cell(u, 15)}
      </div>`
    )
    .join('')

  // แถวรวม 24px เรียงติดกันแบบฟุตเตอร์จริง
  const footerRow = `<div style="display:flex;gap:0;align-items:center;background:#111;padding:8px;border-radius:8px;margin-top:10px">
    ${urls.map((u) => `<span style="display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center"><img src="${u.url}" style="width:24px;height:24px;object-fit:contain" /></span>`).join('')}
  </div>`

  const html = `<!doctype html><meta charset="utf-8"><body style="margin:12px;background:#f5f5f5">
    <div style="font:600 14px sans-serif;margin-bottom:6px">24px (footer) · 15px (review badge)</div>
    ${rows}
    <div style="font:600 14px sans-serif;margin-top:10px">footer row 24px ติดกัน (พื้นดำ):</div>
    ${footerRow}
  </body>`

  await page.route('**/sheet', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }))
  await page.goto(base + '/sheet')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: OUT_PNG, fullPage: true })
  console.log('WROTE', OUT_PNG)
  await browser.close()
  server.close()
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e)
  process.exit(1)
})
