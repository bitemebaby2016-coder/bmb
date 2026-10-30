// e50: เช็คว่ามี test ไหน assert copy สถานะหน้าแรกเดิมไหม (แก้ homeProviders แล้วต้องรู้ก่อน)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const dir = path.join(ROOT, 'src/__tests__')
const re = /เซมเดย์|ส่งทันที|เปิดรับ พรีออเดอร์|ปิดรอบ 05|Same-Day|Pre-Order|ส่งวันนี้|ครัวปรุงเสร็จ/
let n = 0
for (const f of fs.readdirSync(dir)) {
  if (!/\.tsx?$/.test(f)) continue
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n')
  lines.forEach((ln, i) => { if (re.test(ln)) { n++; console.log(f + ':' + (i + 1) + ' | ' + ln.trim().slice(0, 150)) } })
}
console.log('HITS=' + n)