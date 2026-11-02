// e2e/r55_overlay.cjs — ซ้อนโลโก้ 24px แบบ 50% opacity เทียบกัน + วัด ink coverage (พื้นที่สี)
// ใช้ตัดสินว่าตัวไหน "ดูใหญ่" กว่ากันด้วยหลักฐาน ไม่ใช่เดา
const path = require('path')
const fs = require('fs')
const http = require('http')
const { chromium } = require('playwright')

const PUBLIC = path.resolve(__dirname, '..', 'public')
const FILES = ['FB logo.webp', 'Grab Food Logo.webp', 'line logo.webp', 'Messenger logo.webp']
const OUT = path.resolve(__dirname, 'r55_overlay.png')

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
  const base = 'http://127.0.0.1:8923'
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 700, height: 460 }, deviceScaleFactor: 4 })
  await page.goto(base + '/index') // origin เดียวกัน = canvas อ่านพิกเซลได้ (ไม่ tainted)
  const urls = FILES.map((f) => ({ name: f, url: `${base}/${encodeURIComponent(f)}` }))

  // วัด ink coverage ด้วย canvas
  const metrics = await page.evaluate(async (files) => {
    const rows = []
    for (const { name, url } of files) {
      const img = new Image()
      img.src = url
      await img.decode()
      const w = img.naturalWidth
      const h = img.naturalHeight
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, w, h).data
      let ink = 0
      let minX = w, minY = h, maxX = -1, maxY = -1
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const a = d[i + 3] / 255
          ink += a
          if (a > 0.03) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      const cov = ink / (w * h)
      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      rows.push({
        name,
        coverage: +cov.toFixed(3),
        extentGmean: +Math.sqrt((bw / w) * (bh / h)).toFixed(3),
        equivDiameter: +(2 * Math.sqrt(cov / Math.PI)).toFixed(3),
        bbox: `${bw}x${bh}`,
      })
    }
    return rows
  }, urls)

  console.log('METRICS (relative to display box):')
  console.log(JSON.stringify(metrics, null, 2))

  const cell = (u, px, op) =>
    `<span style="display:inline-flex;width:${px}px;height:${px}px;align-items:center;justify-content:center">
       <img src="${u.url}" style="width:${px}px;height:${px}px;object-fit:contain;${op ? 'opacity:.5' : ''}" />
     </span>`

  const overlay = `<div style="position:relative;width:96px;height:96px;background:#fff;border:1px solid #ddd">
    ${urls.map((u) => `<img src="${u.url}" style="position:absolute;inset:0;width:96px;height:96px;object-fit:contain;opacity:.5" />`).join('')}
  </div>`

  const rowSet = (px, bg) =>
    `<div style="display:flex;gap:12px;align-items:center;background:${bg};padding:8px;border-radius:8px">
      ${urls.map((u) => `<div style="text-align:center;color:#888;font:10px sans-serif">${cell(u, px)}<div>${u.name.split(' ')[0]}</div></div>`).join('')}
    </div>`

  const html = `<!doctype html><meta charset="utf-8"><body style="margin:12px;background:#f5f5f5">
    <div style="font:600 13px sans-serif">overlay 96px (50% ทุกตัวซ้อนกัน — ตัวไหนโผล่พ้น = ใหญ่กว่า)</div>
    ${overlay}
    <div style="font:600 13px sans-serif;margin-top:10px">24px บนพื้นฟุตเตอร์ดำ</div>
    ${rowSet(24, '#111')}
    <div style="font:600 13px sans-serif;margin-top:10px">15px บนพื้นขาว (badge)</div>
    ${rowSet(15, '#fff')}
  </body>`

  await page.route('**/sheet', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }))
  await page.goto(base + '/sheet')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: OUT, fullPage: true })
  console.log('WROTE', OUT)
  await browser.close()
  server.close()
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e)
  process.exit(1)
})
