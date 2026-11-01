// helper: node e2e/r44_slice.cjs <file> <startLine> <endLine> (1-based, UTF-8)
'use strict'
const fs = require('fs')
const [, , file, s, e] = process.argv
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
const start = Number(s), end = Number(e)
for (let i = start - 1; i < end && i < lines.length; i++) console.log(`${i + 1}: ${lines[i]}`)