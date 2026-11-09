// R89 SPLICE — แก้ ReviewPage ด้วย "ตัดบรรทัดตามหมายเลข" (ไม่ match escape ให้พลาด · ยืนยัน anchor ก่อนเขียน)
// แทนไฟล์บรรทัด 188-220 (เซคชันรีวิวเก่า 2 อัน) ด้วยบล็อกใหม่จาก e2e/_r89_block.txt
'use strict'
const fs = require('fs')
const FILE = 'src/pages/ReviewPage.tsx'
const raw = fs.readFileSync(FILE, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(/\r?\n/)
const START = 188
const END = 220
const a = lines[START - 1]
const bugline = lines[197]
const b = lines[END - 1]
const c = lines[END]
if (!a || a.trim() !== '<section className=\'mb-10\'>') throw new Error('ANCHOR_FAIL@188: ' + a)
if (!bugline || !bugline.includes('u2B50')) throw new Error('EXPECT_BUGLINE@198: ' + bugline)
if (!b || b.trim() !== '</section>') throw new Error('ANCHOR_FAIL@220: ' + b)
if (!c || !c.includes('<section')) throw new Error('ANCHOR_FAIL@221: ' + c)
const block = fs.readFileSync('e2e/_r89_block.txt', 'utf8').split(/\r?\n/)
const out = lines.slice(0, START - 1).concat(block, lines.slice(END))
fs.writeFileSync(FILE, out.join(eol))
const res = fs.readFileSync(FILE, 'utf8')
console.log('SPLICED lines ' + lines.length + ' -> ' + out.length + ' (replaced ' + (END - START + 1) + ' with ' + block.length + ')')
console.log('CHECK u2B50_gone=' + !res.includes('u2B50') +
  ' | oldHeading_gone=' + !res.includes('Verified Customer Reviews') +
  ' | newHeading=' + res.includes('📸 รีวิวจริงจากลูกค้า') +
  ' | logo=' + res.includes('review-brand-logo') +
  ' | stars=' + res.includes("'⭐'.repeat(") +
  ' | albumMarker=' + res.includes('รูปจริง 32 ใบดูได้ที่เซคชัน Admin Portfolio') +
  ' | adminHeading=' + res.includes('>Admin Portfolio') +
  ' | starPicker=' + res.includes('review-star-picker'))
console.log('--- new region head ---')
out.slice(START - 1, START - 1 + 8).forEach((l, i) => console.log((START + i) + ' | ' + l))
console.log('--- after block ---')
out.slice(START - 1 + block.length, START - 1 + block.length + 3).forEach((l) => console.log('  ' + l))