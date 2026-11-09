// R89 DIAG PROBE (อ่านอย่างเดียว ไม่แก้โค้ด) — หาไฟล์ที่มี review sections / route /shop
// จบแล้วลบทิ้ง
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..', 'src')
const NEEDLES = [
  ['SHOP_ROUTE', /\/shop/i],
  ['VERIFIED_PURCHASE', /Verified Purchase/],
  ['SEC_PHOTO', /รีวิวจริงจากลูกค้า/],
  ['SEC_VERIFIED_TH', /รีวิวจากลูกค้าที่สั่งซื้อจริง/],
  ['SEC_OLD_EN', /Verified Customer Reviews/],
]
const hits = {}
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(tsx|ts)$/.test(f)) {
      const s = fs.readFileSync(p, 'utf8')
      for (const [name, re] of NEEDLES) {
        const m = s.match(re)
        if (m) {
          hits[name] = hits[name] || []
          const line = s.slice(0, m.index).split('\n').length
          hits[name].push(path.relative(ROOT, p) + ':' + line)
        }
      }
    }
  }
}
walk(ROOT)
for (const [name] of NEEDLES) {
  console.log(name + ' => ' + (hits[name] ? hits[name].join(' , ') : '(none)'))
}