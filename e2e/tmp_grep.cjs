'use strict'
// tmp_grep: print lines matching patterns (strip ANSI) — cmd findstr quoting ทำพังค์ในเครื่องนี้
const fs = require('fs')
const file = process.argv[2]
const pats = (process.argv[3] || 'Test Files,Tests ,FAIL,failed,Error').split(',')
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
let hits = 0
lines.forEach((l, i) => {
  const clean = l.replace(/\u001b\[[0-9;]*m/g, '')
  if (pats.some((p) => clean.includes(p))) { hits++; console.log(i + 1 + ': ' + clean.slice(0, 220)) }
})
console.log('HITS=' + hits + ' TOTAL=' + lines.length)
