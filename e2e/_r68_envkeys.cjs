'use strict'
// พิมพ์ "ชื่อ key" ของ env files เท่านั้น — ห้ามพิมพ์ค่า (กัน secret รั่วเข้า transcript)
const fs = require('fs')
for (const f of ['.env', '.env.local', 'secrets.local.env', '.env.example']) {
  if (!fs.existsSync(f)) { console.log('== ' + f + ' (missing)'); continue }
  console.log('== ' + f)
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (m) console.log('  ' + m[1])
  })
}