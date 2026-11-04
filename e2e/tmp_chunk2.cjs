'use strict'
// tmp_chunk2 — exact regions: state-vendor head (interop), react-vendor useCallback export,
// and index line 30 around col 12177 (function cc)
const fs = require('fs')
function lineCol(file, line, col, span) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const l = lines[line - 1] || ''
  console.log('== ' + file + ' line ' + line + ' len=' + l.length + ' @col ' + col + ' ==')
  console.log(l.slice(Math.max(0, col - span), col + span))
}
const sv = fs.readFileSync('dist/assets/state-vendor-gNW87BoF.js', 'utf8')
console.log('== state-vendor HEAD 0..1100 ==')
console.log(sv.slice(0, 1100))
const rv = fs.readFileSync('dist/assets/react-vendor-DLS49qVy.js', 'utf8')
const i = rv.indexOf('.useCallback=')
console.log('== react-vendor .useCallback= @' + i + ' ==')
console.log(rv.slice(Math.max(0, i - 300), i + 200))
const j = rv.indexOf('useCallback')
console.log('== react-vendor first useCallback @' + j + ' ==')
console.log(rv.slice(Math.max(0, j - 200), j + 300))
lineCol('dist/assets/index-ulWufhxi.js', 30, 12177, 350)
console.log('DONE')
