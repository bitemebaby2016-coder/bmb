// R88 helper — repo search (ชั่วคราว: ค้นจบจะลบ) — findstr กิน quote ในเครื่องนี้
// usage: node e2e\_r88_find.cjs [root1;root2] regex1 regex2 ...
'use strict'
const fs = require('fs')
const path = require('path')
const roots = (process.argv[2] || 'src').split(';')
const pats = process.argv.slice(3)
if (!pats.length) { console.error('usage: node _r88_find.cjs [roots;sep] regex...'); process.exit(2) }
const res = []
for (const root of roots) {
  if (!fs.existsSync(root)) { console.log('MISS_ROOT ' + root); continue }
  ;(function walk(d) {
    if (!fs.statSync(d).isDirectory()) { // root เป็นไฟล์เดี่ยวก็ค้นได้
      const lines = fs.readFileSync(d, 'utf8').split(/\r?\n/)
      lines.forEach((ln, i) => {
        for (const pat of pats) {
          if (new RegExp(pat, 'i').test(ln)) { res.push(d + ':' + (i + 1) + ': ' + ln.trim().slice(0, 240)); break }
        }
      })
      return
    }
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(p) }
      else if (/\.(ts|tsx|js|jsx|sql)$/.test(e.name)) {
        const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
        lines.forEach((ln, i) => {
          for (const pat of pats) {
            if (new RegExp(pat, 'i').test(ln)) { res.push(p + ':' + (i + 1) + ': ' + ln.trim().slice(0, 240)); break }
          }
        })
      }
    }
  })(root)
}
console.log('MATCHES ' + res.length)
res.slice(0, 300).forEach((r) => console.log(r))
