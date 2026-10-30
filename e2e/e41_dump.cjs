// e41: dump middle สองไฟล์พิมพ์ (ranged read โดน marker outdated) + หาหน้า Login/signIn จริง
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const dumpRange = (rel, a, b) => {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/)
  console.log('===== ' + rel + ' [' + a + '-' + b + '] =====')
  for (let i = a - 1; i < b && i < lines.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
}
dumpRange('src/pages/admin/AdminPrintSettings.tsx', 62, 181)
dumpRange('src/lib/printService.ts', 90, 477)
const hits = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); continue }
    if (!/\.tsx?$/.test(e.name)) continue
    const t = fs.readFileSync(p, 'utf8')
    if (/signInWithPassword|signInWithOAuth|provider.*google|Google.*เข้า|path.*login/i.test(t)) {
      hits.push(path.relative(ROOT, p) + ' (' + t.split(/\r?\n/).length + ' บรรทัด)')
    }
  }
}
walk(path.join(ROOT, 'src'))
console.log('===== LOGIN FILES =====')
hits.forEach((h) => console.log(h))