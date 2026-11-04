// Task C scratch: node e2e\_c_view.cjs <file> <from> <to>
const fs = require('fs')
const file = process.argv[2]
const from = parseInt(process.argv[3], 10)
const to = parseInt(process.argv[4], 10)
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
for (let i = from; i <= to && i <= lines.length; i++) console.log(i + ' | ' + lines[i - 1])
console.log('TOTAL=' + lines.length)