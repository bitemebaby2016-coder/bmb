'use strict'
// tmp_rrdep — which installed packages reference react-router(-dom) (deps/peer/require/import)
const fs = require('fs')
const path = require('path')
const hits = []
function scan(dir, depth) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const p = path.join(dir, e.name)
    if (e.name.startsWith('@')) { scan(p, depth); continue }
    const pj = path.join(p, 'package.json')
    if (fs.existsSync(pj)) {
      let t = ''
      try { t = fs.readFileSync(pj, 'utf8') } catch { }
      if (t.includes('react-router')) hits.push('PKG ' + p)
      // nested node_modules
      const nm = path.join(p, 'node_modules')
      if (fs.existsSync(nm)) scan(nm, depth + 1)
    }
  }
}
scan('node_modules', 0)
// also: source files under node_modules that require('react-router')
for (const h of hits) console.log(h)
console.log('HITS=' + hits.length)
console.log('DONE')