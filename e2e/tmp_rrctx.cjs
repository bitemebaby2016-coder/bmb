'use strict'
// tmp_rrctx — show context around each duplicated invariant string in react-vendor
const fs = require('fs')
const file = 'dist/assets/react-vendor-CpcGkcko.js'
const t = fs.readFileSync(file, 'utf8')
const needle = 'useNavigate() may be used only'
let idx = 0
let n = 0
while ((idx = t.indexOf(needle, idx)) !== -1) {
  n++
  console.log('=== hit ' + n + ' at offset ' + idx + ' ===')
  console.log(t.slice(Math.max(0, idx - 500), idx + 300).replace(/\n/g, ' '))
  console.log('')
  idx += needle.length
}
// helper markers that betray CJS interop
const marks = ['__commonJS', '__toESM', 'require_', 'init_react_router', 'import_react_router', 'require("react-router")', "require('react-router')"]
for (const m of marks) console.log('marker ' + JSON.stringify(m) + ' = ' + (t.split(m).length - 1))
console.log('DONE')