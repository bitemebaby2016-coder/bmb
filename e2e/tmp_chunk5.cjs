'use strict'
// tmp_chunk5 — confirm duplicate-react theory for boot crash
// ("Cannot read properties of null (reading 'useCallback')" at react-vendor)
const fs = require('fs')
const t = fs.readFileSync('dist/assets/react-vendor-DLS49qVy.js', 'utf8')
const lines = t.split(/\r?\n/)
console.log('== per-line map ==')
lines.forEach((l, i) => {
  const marks = []
  if (l.includes('CLIENT_INTERNALS')) marks.push('INTERNALS')
  if (l.includes('useCallback=function')) marks.push('HOOKDEF')
  if (l.includes('useSyncExternalStore')) marks.push('USES')
  if (l.includes('__commonJS') || l.includes('require_')) marks.push('CJS')
  console.log('L' + (i + 1) + ' len=' + l.length + ' [' + marks.join(',') + '] head=' + l.slice(0, 80))
})
function all(pat) {
  let at = 0
  while ((at = t.indexOf(pat, at)) !== -1) {
    console.log('HIT ' + pat + ' @' + at + ' :: ' + t.slice(Math.max(0, at - 80), at + 90).replace(/\s+/g, ' '))
    at += pat.length
  }
}
console.log('== useCallback defs ==')
all('.useCallback=function')
console.log('== Xr def (export o used by state-vendor) ==')
all('Xr=')
console.log('== module path keys ==')
all('node_modules')
console.log('== internals literals ==')
all('H:null')
console.log('DONE')
