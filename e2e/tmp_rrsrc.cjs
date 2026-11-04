'use strict'
// tmp_rrsrc — every react-router specifier used by app source + non-ts files in src
const fs = require('fs')
const path = require('path')
const specifiers = new Map()
const oddFiles = []
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, f.name)
    if (f.isDirectory()) { walk(fp); continue }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|html)$/.test(f.name)) continue
    if (!/\.(ts|tsx)$/.test(f.name)) oddFiles.push(fp)
    const t = fs.readFileSync(fp, 'utf8')
    const re = /['"]((?:@\/)?react-router(?:-dom)?(?:\/[\w.-]+)?)['"]/g
    let m
    while ((m = re.exec(t))) {
      const s = m[1]
      specifiers.set(s, (specifiers.get(s) || 0) + 1)
    }
    if (t.includes('require(') && t.includes('react-router')) console.log('REQUIRE in ' + fp)
  }
}
walk('src')
console.log('--- specifiers ---')
for (const [s, n] of [...specifiers].sort()) console.log('  ' + s + ' x' + n)
console.log('--- non-ts files under src ---')
for (const f of oddFiles) console.log('  ' + f)
console.log('DONE')