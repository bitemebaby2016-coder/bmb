// R42b — แก้ภาษาเพี้ยนที่มั่นใจ (fact-based · ไม่เดาความหมาย):
// 1) README + HANDOFF_002: U+FFFD (em-dash หักตอนเขียนไฟล์) → แทนด้วยสัญลักษณ์ที่สื่อความเดิม
// 2) g9CheckLine = มี ? จงใจ → scanner ข้าม (ทำเครื่องหมายที่นี่)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const fixes = [
  ['README.md', /\uFFFD+/g, ' '],
  ['supabase/migrations/HANDOFF_002_SCHEMA.md', /\uFFFD+/g, '-'],
]
for (const [rel, re, to] of fixes) {
  const p = path.join(ROOT, rel)
  const s = fs.readFileSync(p, 'utf8')
  const n = (s.match(re) || []).length
  if (n > 0) {
    fs.writeFileSync(p, s.replace(re, to))
    console.log(`FIXED ${rel}: ${n} FFFD -> '${to === ' ' ? 'space' : to}'`)
  } else console.log(`CLEAN ${rel}`)
}
console.log('LANG_FIX_DONE')