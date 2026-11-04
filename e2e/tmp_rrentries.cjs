'use strict'
// tmp_rrentries — show what each react-router entry re-exports (dev + prod)
const fs = require('fs')
const files = [
  'node_modules/react-router/dist/development/index.mjs',
  'node_modules/react-router/dist/development/index.js',
  'node_modules/react-router/dist/development/dom-export.mjs',
  'node_modules/react-router/dist/development/dom-export.js',
  'node_modules/react-router/dist/production/index.mjs',
  'node_modules/react-router/dist/production/dom-export.mjs',
]
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('MISSING ' + f); continue }
  const t = fs.readFileSync(f, 'utf8')
  const lines = t.split(/\r?\n/)
  const head = lines.slice(0, 40).filter((l) => /^(import|export|var .*require|module\.exports)/.test(l.trim()) || l.includes('require('))
  console.log('=== ' + f + ' size=' + t.length + ' lines=' + lines.length)
  for (const l of head.slice(0, 12)) console.log('   ' + l.trim().slice(0, 200))
}
// which chunk files exist in development
const dev = 'node_modules/react-router/dist/development'
console.log('=== ' + dev + ' file list')
console.log(fs.readdirSync(dev).filter((f) => /\.(mjs|js)$/.test(f)).join(' | '))
console.log('DONE')