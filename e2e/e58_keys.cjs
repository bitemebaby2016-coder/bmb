// e58: รายชื่อ key ใน .env.local (เฉพาะชื่อ — ห้ามพิมพ์ค่า)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const lines = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')
lines.forEach((l) => {
  const t = l.trim()
  if (t && !t.startsWith('#') && t.includes('=')) console.log(t.split('=')[0])
})