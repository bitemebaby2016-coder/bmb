// e2e/r55_alpha_bbox.cjs — R55 step 1: วัด visible/alpha bbox ของโลโก้ทุกตัวด้วย playwright canvas
// (เครื่องไม่มี magick/ffmpeg/cwebp — ใช้ chromium canvas เท่านั้น)
// ผล: ถ้า padding/visible fraction ของ `FB logo.webp` ต่างจาก reference (Grab/line/Messenger)
//      → ยืนยันสมมติฐาน artwork padding → normalize รอบถัดไป
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

// เสิร์ฟเฉพาะไฟล์ที่ต้องการผ่าน 127.0.0.1 — canvas อ่านพิกเซลได้โดยไม่ tainted
// port คงที่ในช่วง safe (chromium บล็อก port 2049 = ERR_UNSAFE_PORT)
function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const name = decodeURIComponent(req.url.replace(/^\//, ''))
      if (!FILES.includes(name)) {
        res.writeHead(404).end('nope')
        return
      }
      const buf = fs.readFileSync(path.join(PUBLIC, name))
      res.writeHead(200, { 'Content-Type': 'image/webp' }).end(buf)
    })
    server.on('error', reject)
    server.listen(8923, '127.0.0.1', () => resolve(server))
  })
}

async function main() {
  const server = await serve()
  const base = `http://127.0.0.1:${server.address().port}`
  const urls = FILES.map((f) => ({ name: f, url: `${base}/${encodeURIComponent(f)}` }))
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(base + '/index')

  const results = await page.evaluate(async (files) => {
    function bbox(data, w, h, test) {
      let minX = w, minY = h, maxX = -1, maxY = -1, count = 0
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          if (test(data, i)) {
            count++
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      if (maxX < 0) return null
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, count }
    }

    const out = []
    for (const { name, url } of files) {
      const img = new Image()
      img.src = url
      try {
        await img.decode()
      } catch (e) {
        out.push({ name, error: String(e) })
        continue
      }
      const w = img.naturalWidth
      const h = img.naturalHeight
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, w, h)

      // alpha bbox (pixel โปร่งใสที่มีเนื้อ)
      const alphaBox = bbox(data, w, h, (d, i) => d[i + 3] > 8)
      // content bbox (ต่างจากสีมุมซ้ายบน — เผื่อไฟล์ที่ไม่มี alpha channel)
      const bg = [data[0], data[1], data[2]]
      const dist = (d, i) =>
        Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2])
      const contentBox = bbox(data, w, h, (d, i) => d[i + 3] > 8 && dist(d, i) > 24)

      const b = alphaBox && alphaBox.count > 0 ? alphaBox : contentBox
      out.push({
        name,
        dims: `${w}x${h}`,
        alphaBox: alphaBox ? `${alphaBox.x},${alphaBox.y} ${alphaBox.w}x${alphaBox.h}` : 'NONE',
        contentBox: contentBox ? `${contentBox.x},${contentBox.y} ${contentBox.w}x${contentBox.h}` : 'NONE',
        visible: b ? { w: b.w, h: b.h, fx: +(b.w / w).toFixed(3), fy: +(b.h / h).toFixed(3) } : null,
        bg: bg.join(','),
      })
    }
    return out
  }, urls)

  console.log(JSON.stringify(results, null, 2))
  await browser.close()
  server.close()
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e)
  process.exit(1)
})
