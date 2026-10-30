// e53: หา copy เก่าที่เหลือใน src (non-test) หลังแก้ค่าใหม่ (admin UI placeholder อาจ hardcode)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const re = /เปิดรับออเดอร์ เซมเดย์|เปิดรับ พรีออเดอร์|ปิดรอบ 05:00|ส่งทันที'/
let n = 0
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); continue }
    if (!/\.tsx?$/.test(e.name)) continue
    const lines = fs.readFileSync(p, 'utf8').split('\n')
    lines.forEach((ln, i) => { if (re.test(ln)) { n++; console.log(path.relative(ROOT, p) + ':' + (i + 1) + ' | ' + ln.trim().slice(0, 150)) } })
  }
}
walk(path.join(ROOT, 'src'))
console.log('HITS=' + n)