// r59_heads.cjs <file> — พิมพ์บรรทัดหัวข้อ ## / ###
const fs = require('fs')
fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).forEach((s, i) => {
  if (/^#{2,3} /.test(s)) console.log(i + 1 + ': ' + s)
})