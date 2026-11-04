'use strict'
// tmp_rrcount — count useNavigate/useLocation invariant strings per source file + per dist chunk
const fs = require('fs')
const path = require('path')
const NAV = 'useNavigate() may be used only'
const LOC = 'useLocation() may be used only'
const srcs = [
  'node_modules/react-router/dist/development/index.mjs',
  'node_modules/react-router/dist/development/dom-export.mjs',
  'node_modules/react-router/dist/development/chunk-BV7QT456.mjs',
  'node_modules/react-router/dist/development/chunk-HT4INDD5.mjs',
  'node_modules/react-router-dom/dist/index.mjs',
  'node_modules/react-router/dist/development/index.js',
  'node_modules/react-router/dist/development/dom-export.js',
  'node_modules/react-router/dist/development/chunk-QPXIKN46.js',
  'node_modules/react-router/dist/development/chunk-YRTY65LJ.js',
  'node_modules/react-router/dist/development/chunk-7SIULPXI.js',
]
for (const f of srcs) {
  if (!fs.existsSync(f)) { console.log('MISSING ' + f); continue }
  const t = fs.readFileSync(f, 'utf8')
  console.log('SRC ' + path.basename(f) + ' nav=' + (t.split(NAV).length - 1) + ' loc=' + (t.split(LOC).length - 1) + ' size=' + t.length)
}
console.log('--- dist/assets ---')
for (const f of fs.readdirSync('dist/assets')) {
  if (!f.endsWith('.js')) continue
  const t = fs.readFileSync(path.join('dist/assets', f), 'utf8')
  const nav = t.split(NAV).length - 1
  const loc = t.split(LOC).length - 1
  if (nav || loc) console.log('DIST ' + f + ' nav=' + nav + ' loc=' + loc + ' size=' + t.length)
}
console.log('DONE')