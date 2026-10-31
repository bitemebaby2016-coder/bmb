// R42c — ล้าง raw U+FFFD ออกจากสคริปต์สแกนเนอร์เอง (languageSanity จับได้ = fail ทั้งที่เป็นเครื่องมือตรวจ)
// ใช้ fromCharCode = ไฟล์นี้ ASCII ล้วน ไม่มี char เพี้ยน
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const FFFD = String.fromCharCode(65533)
const targets = ['e2e/r42_lang_scan.cjs', 'e2e/r42_lang_fix.cjs']
for (const rel of targets) {
  const p = path.join(ROOT, rel)
  const s = fs.readFileSync(p, 'utf8')
  const n = (s.match(new RegExp(FFFD, 'g')) || []).length
  if (n === 0) { console.log('CLEAN ' + rel); continue }
  // แทน raw char ใน string/regex ด้วย escape text \uFFFD (คงความหมายตอนรัน)
  const out = s
    .split("'" + FFFD + "'").join("'\\uFFFD'")
    .split(FFFD + '+').join('\\uFFFD+')
    .split(FFFD).join('\\uFFFD')
  fs.writeFileSync(p, out)
  console.log('REPLACED ' + rel + ' n=' + n)
}
console.log('CLEANER_DONE')