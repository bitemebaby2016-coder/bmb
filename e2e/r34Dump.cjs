// R34: dump ไฟล์ที่ read tool ค้าง — เลขบรรทัด + ช่วงที่ต้องแก้ (ไม่แตะ source)
const fs = require('fs')
const jobs = [
  ['src/pages/admin/AdminRounds.tsx', 90, 275],
]
const out = []
for (const [file, a, b] of jobs) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  out.push(`===== ${file} (${a}-${b}) =====`)
  for (let i = a; i <= Math.min(b, lines.length); i++) out.push(`${i}: ${lines[i - 1]}`)
  out.push('')
}
fs.writeFileSync('e2e/r34_dump2.txt', out.join('\n'))
console.log('DUMP_OK lines=' + out.length)
