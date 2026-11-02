// r59_errscan.cjs — สรุปบรรทัด Errors/Test Files/Tests ใน log vitest หลายไฟล์
const fs = require('fs')
for (const f of process.argv.slice(2)) {
  const t = fs.readFileSync(f, 'utf8')
  const lines = t.split(/\r?\n/).filter((s) => /Test Files|Tests |Errors |Unhandled/.test(s))
  console.log('== ' + f)
  for (const l of lines) console.log('   ' + l.replace(/\u001b\[[0-9;]*m/g, ''))
}