'use strict'
// tmp_find: print files under src (or given root) containing any comma-separated pattern
const fs = require('fs')
const path = require('path')
const root = process.argv[2] || 'src'
const pats = (process.argv[3] || '').split(',').filter(Boolean)
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, f.name)
    if (f.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(fp)
      continue
    }
    if (!/\.(ts|tsx|js|jsx|html|json|sql|cjs|mjs)$/.test(f.name)) continue
    let t = ''
    try { t = fs.readFileSync(fp, 'utf8') } catch { continue }
    const found = pats.filter((p) => t.includes(p))
    if (found.length) console.log(fp.split(path.sep).join('/') + '  [' + found.join(' | ') + ']')
  }
}
walk(root)
console.log('DONE')