// e2e/r54_ftimes.cjs — mtime/size โลโก้ (หลักฐานว่าไฟล์ไหนถูกแทนเมื่อไหร่ ตอนปิดเซสชัน R54)
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'public')
for (const f of ['FB logo.webp', 'Facebook Logo.webp', 'Messenger logo.webp', 'Grab Food Logo.webp', 'line logo.webp']) {
  const s = fs.statSync(path.join(dir, f))
  console.log(`${f} | bytes=${s.size} | mtime=${s.mtime.toISOString()}`)
}
