// R52 — hex dump codepoint แถวเป้าหมาย (หนีปัญหา display แปลงอีโมจิ)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
function dump(file, needle) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/)
  const i = lines.findIndex((l) => l.includes(needle))
  if (i < 0) { console.log(file, 'NOT FOUND', needle); return }
  const line = lines[i]
  // โชว์ codepoint รอบ ๆ ตำแหน่งที่เจอ needle
  const at = line.indexOf(needle)
  const seg = Array.from(line.slice(Math.max(0, at - 6), at + needle.length + 10))
  const hex = seg.map((c) => c.codePointAt(0).toString(16)).join(' ')
  console.log(`${file}:${i + 1} [${needle}] hex=${hex}`)
  console.log('  raw=' + JSON.stringify(line.slice(at, at + needle.length + 30)))
}
dump('src/__tests__/r44StatusStrip.test.ts', 'strip-preorder')
dump('src/components/home/StoreStatusStrip.tsx', 'strip-preorder')
dump('src/lib/homeProviders.ts', 'จองล่วงหน้า :')
dump('src/lib/storeStatusCopy.ts', 'preOrderClosed:')
