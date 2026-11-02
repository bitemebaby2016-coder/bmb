// N3 asset check — รูปโลโก้ปุ่มโซเชียลที่ Footer/socialLinks อ้างมีจริงใน public/ ไหม (READ-ONLY)
const fs = require('fs')
const path = require('path')
const PUB = path.join(__dirname, '..', 'public')
const refs = ['/Facebook Logo.webp', '/Messenger logo.webp', '/line logo.webp']
for (const r of refs) {
  const ok = fs.existsSync(path.join(PUB, r.slice(1)))
  console.log(ok ? 'EXISTS' : 'MISSING', r)
}
const all = fs.readdirSync(PUB).filter((f) => /\.webp$/i.test(f))
console.log('WEBP_COUNT', all.length)
console.log(all.join(' | '))