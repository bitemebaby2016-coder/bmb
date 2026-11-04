'use strict'
// tmp_chunk4 — exact crash site (line 11 col 44974) + defs of exports o (Xr) / x (r)
const fs = require('fs')
const lines = fs.readFileSync('dist/assets/react-vendor-DLS49qVy.js', 'utf8').split(/\r?\n/)
console.log('react-vendor lines=' + lines.length)
const l11 = lines[10] || ''
console.log('line11 len=' + l11.length)
console.log('== line11 @44974 ==')
console.log(l11.slice(44674, 45374))
const l1 = lines[0] || ''
// find Xr and r definitions at top-level: search 'Xr=' and ',r=' patterns near start
for (const name of ['Xr=', 'function Xr', ',r=function', ' r=', 'var r=']) {
  const i = l1.indexOf(name)
  if (i !== -1) {
    console.log('== l1 "' + name + '" @' + i + ' ==')
    console.log(l1.slice(Math.max(0, i - 100), i + 300))
    break
  }
}
console.log('DONE')
