'use strict'
// tmp_router_scan — count react-router copies in dist (same class as the react dup)
const fs = require('fs')
const path = require('path')
const MARK = 'may be used only in the context of a <Router>'
const CTX = 'useNavigate'
for (const f of fs.readdirSync('dist/assets')) {
  if (!f.endsWith('.js')) continue
  const t = fs.readFileSync(path.join('dist/assets', f), 'utf8')
  const marks = t.split(MARK).length - 1
  const nav = t.split('useNavigate').length - 1
  const router = t.split('react-router').length - 1
  if (marks || nav) console.log(f, 'routerErrStr=' + marks, 'useNavigate=' + nav, 'react-router-refs=' + router)
}
console.log('DONE')
