// R20 production probe — เช็กว่า biteme-baby.com เสิร์ฟ build ของรอบนี้แล้วหรือยัง
// วิธี: เอาชื่อ asset จาก dist/index.html (build ล่าสุดบนเครื่อง) ไปยิง production ตรง ๆ
// Run: node e2e/r19bProdProbe.cjs
const fs = require('fs')
const path = require('path')

const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8')
const assets = [...html.matchAll(/\/assets\/(index-[A-Za-z0-9_-]+\.(?:js|css))/g)].map((m) => m[1])

;(async () => {
  if (assets.length === 0) return console.log('NO_ASSET_IN_DIST — build ยังไม่ถูกรัน?')
  for (const f of assets) {
    try {
      const r = await fetch('https://biteme-baby.com/assets/' + f)
      console.log(`${f} -> HTTP ${r.status} (${r.status === 200 ? 'SERVING ของรอบนี้' : 'ยังไม่ deploy/ไม่พบ'})`)
    } catch (e) {
      console.log(`${f} -> ERR ${String(e).slice(0, 120)}`)
    }
  }
})()
