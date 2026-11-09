// ค้นคำไทยใน src (findstr UTF-8 เชื่อถือไม่ได้) — หาตำแหน่งปุ่มสั่ง/จอง + promo หมดอายุ
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const NEEDLES = ['expires', 'หมดอายุ', 'end_date', 'valid_until', 'active_until', 'is_active']
function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx?|ts)$/.test(e.name)) out.push(p)
  }
  return out
}
for (const f of walk(path.join(ROOT, 'src'))) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  lines.forEach((l, i) => {
    for (const n of NEEDLES) {
      if (l.includes(n)) {
        console.log(path.relative(ROOT, f) + ':' + (i + 1) + ' [' + n + '] ' + l.trim().slice(0, 120))
        break
      }
    }
  })
}