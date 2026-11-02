// r59_tail.cjs <file> [n] — บรรทัดรวม + n บรรทัดท้าย
const fs = require('fs')
const l = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/)
const n = Number(process.argv[3] || 15)
console.log('TOTAL=' + l.length)
console.log(l.slice(-n).join('\n'))