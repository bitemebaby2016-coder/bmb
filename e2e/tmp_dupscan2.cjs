'use strict'
// tmp_dupscan2 — per-source-copy counts of useNavigate/useLocation invariant strings
const fs = require('fs')
const files = [
  'node_modules/react-router/dist/production/chunk-6XRGXNVQ.js',
  'node_modules/react-router/dist/production/chunk-EFMJ2SG4.mjs',
  'node_modules/react-router/dist/production/index.js',
  'node_modules/react-router/dist/production/index.mjs',
  'node_modules/react-router-dom/dist/index.js',
  'node_modules/react-router-dom/dist/main.js',
  'dist/assets/react-vendor-CpcGkcko.js',
]
const probes = [
  'useNavigate() may be used only',
  'useLocation() may be used only',
  'useNavigate must be used within a Router',
  'invariant',
  'NavigationContext',
]
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('MISSING ' + f); continue }
  const t = fs.readFileSync(f, 'utf8')
  const out = probes.map((p) => p.split('(')[0].split(' ')[0] + '=' + (t.split(p).length - 1)).join(' ')
  console.log(f + ' size=' + t.length + ' ' + out)
}
// also: list react-router-dom dist files
const rrd = 'node_modules/react-router-dom/dist'
if (fs.existsSync(rrd)) console.log('rrd files: ' + fs.readdirSync(rrd).join(', '))
console.log('DONE')