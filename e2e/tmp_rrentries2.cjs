'use strict'
// tmp_rrentries2 — which chunk each react-router entry imports (CJS require vs ESM import)
const fs = require('fs')
const files = [
  'node_modules/react-router/dist/development/index.mjs',
  'node_modules/react-router/dist/development/dom-export.mjs',
  'node_modules/react-router/dist/development/index.js',
  'node_modules/react-router/dist/development/dom-export.js',
  'node_modules/react-router/dist/production/index.mjs',
  'node_modules/react-router/dist/production/dom-export.mjs',
  'node_modules/react-router-dom/dist/index.mjs',
]
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('MISSING ' + f); continue }
  const t = fs.readFileSync(f, 'utf8')
  const targets = new Set()
  const re1 = /from\s+["']([^"']+)["']/g
  let m
  while ((m = re1.exec(t))) targets.add(m[1])
  const re2 = /require\(["']([^"']+)["']\)/g
  while ((m = re2.exec(t))) targets.add(m[1])
  console.log('=== ' + f + ' size=' + t.length)
  for (const s of targets) console.log('     <- ' + s)
}
console.log('DONE')