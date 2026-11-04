'use strict'
// tmp_chunk3 — count react copies in react-vendor + map exports o/x
const fs = require('fs')
const rv = fs.readFileSync('dist/assets/react-vendor-DLS49qVy.js', 'utf8')
const M = '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE'
let at = 0
const positions = []
while ((at = rv.indexOf(M, at)) !== -1) { positions.push(at); at += M.length }
console.log('CLIENT_INTERNALS occurrences=' + positions.length)
for (const p of positions) {
  console.log('--- @' + p + ' ---')
  console.log(rv.slice(Math.max(0, p - 180), p + 120).replace(/\n/g, ' '))
}
const exp = rv.lastIndexOf('export{')
console.log('== export tail ==')
console.log(rv.slice(exp, exp + 600))
const oDef = rv.indexOf('o=')
console.log('DONE')
