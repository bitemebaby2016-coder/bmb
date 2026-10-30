// e42: dump printService 90-407 (จุดที่ output e41 โดนตัด) + หาหน้า Login
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const lines = fs.readFileSync(path.join(ROOT, 'src/lib/printService.ts'), 'utf8').split(/\r?\n/)
for (let i = 89; i < 407; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
console.log('===== LOGIN PAGE CANDIDATES =====')
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); continue }
    if (/login|auth/i.test(e.name)) console.log(path.relative(ROOT, p))
  }
}
walk(path.join(ROOT, 'src/pages'))
walk(path.join(ROOT, 'src/routes'))