// e64: ดึง assert จริง 2 ไฟล์ที่ CI แดง (word-exact ก่อนแก้)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
for (const rel of ['src/__tests__/authProbeRoles.test.ts', 'src/__tests__/r16MultiJobRiderStrip.test.ts']) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n')
  console.log('===== ' + rel + ' =====')
  lines.forEach((l, i) => {
    if (/navigate\(returnTo|ปิดรอบ|preOrderLine|เซมเดย์|Same-Day|toContain|toMatch/.test(l)) console.log(String(i + 1).padStart(4) + ' | ' + l)
  })
}