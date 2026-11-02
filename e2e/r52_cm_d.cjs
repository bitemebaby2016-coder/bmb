// R52 cm_d — ซ่อม comment ซ้ำใน storeStatusCopy (จาก cm_a รัน 2 รอบ) + verify ภาพรวมทุกไฟล์
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const CAL = '\u{1F4C5}'

// 1) dedupe comment R52 ติดกัน
{
  const p = 'src/lib/storeStatusCopy.ts'
  const lines = fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/)
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const isDup = lines[i].includes('// R52: หัวข้อ+ไอคอนอยู่ฝั่ง strip') &&
      out.length > 0 && out[out.length - 1].includes('// R52: หัวข้อ+ไอคอนอยู่ฝั่ง strip')
    if (!isDup) out.push(lines[i])
  }
  fs.writeFileSync(path.join(ROOT, p), out.join('\n'), 'utf8')
}

// 2) verifies ภาพรวม
function cnt(rel, needle) {
  return (fs.readFileSync(path.join(ROOT, rel), 'utf8').split(needle).length - 1)
}
const checks = [
  ['src/lib/homeProviders.ts', 'const preOrderLine = (() => {', 1],
  ['src/lib/homeProviders.ts', "const depart =", 1],
  ['src/lib/homeProviders.ts', 'delivery_start', 2], // depart + sameDay upcoming อย่างน้อย 2
  ['src/lib/storeStatusCopy.ts', "preOrderClosed: 'ปิดรับแล้ว", 1],
  ['src/lib/storeStatusCopy.ts', '// R52: หัวข้อ+ไอคอนอยู่ฝั่ง strip', 1],
  ['src/pages/admin/AdminSettings.tsx', CAL + ' Pre-Order / จองล่วงหน้า', 1],
  ['src/components/home/StoreStatusStrip.tsx', 'strip-preorder', 2], // testid + comment? (comment ไม่มี strip-preorder → p มี 1, +import? ตรวจ >=1)
]
for (const [rel, needle, expect] of checks) {
  const c = cnt(rel, needle)
  const min = needle === 'delivery_start' ? c >= expect : c === expect
  if (needle === 'strip-preorder') {
    if (c < 1) throw new Error(rel + ' ' + needle + ' count=' + c)
  } else if (!min) throw new Error(rel + ' ' + needle + ' count=' + c + ' expect=' + expect)
  console.log('VERIFY ' + rel + ' [' + needle + '] = ' + c)
}
const strip = fs.readFileSync(path.join(ROOT, 'src/components/home/StoreStatusStrip.tsx'), 'utf8')
if (!strip.includes('\u{1F6F5}')) throw new Error('strip missing scooter')
if (strip.includes('\u7535\u8f66')) throw new Error('strip Chinese leak')
console.log('CM_D DONE + all verified')