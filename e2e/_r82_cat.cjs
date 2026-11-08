// cat แบบมีเลขบรรทัด (ใช้ตอน read tool ติด stale-cache) — READ-ONLY
// Usage: node e2e\_r82_cat.cjs <path relative to repo> [startLine] [endLine]
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const p = process.argv[2]
if (!p) { console.error('usage: _r82_cat.cjs <path> [start] [end]'); process.exit(1) }
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
const s = Math.max(1, Number(process.argv[3] || 1))
const e = Math.min(lines.length, Number(process.argv[4] || lines.length))
for (let i = s - 1; i < e; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
console.log('CAT_DONE total=' + lines.length)