'use strict'
// _r68_find — grep ง่าย ๆ แบบ UTF-8 (findstr ใน harness นี้พังกับ quote/Thai)
// usage: node e2e/_r68_find.cjs <pattern> [dir]
const fs = require('fs')
const path = require('path')
const pat = process.argv[2]
if (!pat) { console.error('need pattern'); process.exit(2) }
const dirs = [process.argv[3] || 'supabase/migrations']
let hits = 0
const re = new RegExp(pat, 'i')
for (const d of dirs) {
  if (!fs.existsSync(d)) { console.log('NO_DIR ' + d); continue }
  for (const f of fs.readdirSync(d)) {
    if (!/\.(sql|md|cjs|ts|yml|yaml)$/.test(f)) continue
    const p = path.join(d, f)
    let txt = ''
    try { txt = fs.readFileSync(p, 'utf8') } catch (e) { continue }
    txt.split(/\r?\n/).forEach((line, i) => {
      if (re.test(line)) { hits++; console.log(p + ':' + (i + 1) + ': ' + line.trim().slice(0, 220)) }
    })
  }
}
console.log('HITS=' + hits)