// R52 cm_c2 — storeStatusWindow + storeStatusCopy + r13 tests
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const L = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/)
const W = (p, l) => fs.writeFileSync(path.join(ROOT, p), l.join('\n'), 'utf8')
function fix(p, ops) {
  const a = L(p)
  for (const [pred, label, repl] of ops) {
    const hits = a.map((x, i) => (pred(x) ? i : -1)).filter((i) => i >= 0)
    if (hits.length !== 1) throw new Error(p + ' ' + label + ' hits=' + hits.length)
    const i = hits[0]
    if (repl === null) a.splice(i, 1)
    else if (Array.isArray(repl)) a.splice(i, 1, ...repl)
    else a[i] = repl
  }
  W(p, a)
  const back = fs.readFileSync(path.join(ROOT, p), 'utf8')
  if (back.includes('\u7535\u8f66')) throw new Error('CHINESE LEAK in ' + p)
  console.log('OK ' + p)
}

// ---- storeStatusWindow ----
fix('src/__tests__/storeStatusWindow.test.ts', [
  [(x) => x.includes("toContain('รอบวันที่ 27')"), 'name27',
    ["    expect(s.preOrderLine).toContain('11:00 AM') // R52: เวลาออกส่งจริงแทนชื่อรอบ",
     "    expect(s.preOrderLine).not.toContain('รอบวันที่ 27')"]],
  [(x) => x.includes('// R25 (Owner 2026-10-30)'), 'cmtR25',
    '    // R52 (Owner 2026-11-01): body = "รอบส่งถัดไป <เวลาออกส่งจริง> … (ปิดรับ HH:MM AM/PM)" — หัวข้อ/ไอคอนอยู่ฝั่ง strip'],
  [(x) => x.includes('toMatch(/จองล่วงหน้า : รอบส่ง/)'), 'matchPre',
    '    expect(s.preOrderLine).toMatch(/^รอบส่งถัดไป /)'],
])

// ---- storeStatusCopy ----
fix('src/__tests__/storeStatusCopy.test.ts', [
  [(x) => x.includes('// R44 (Owner 2026-11-01): รูปแบบใหม่'), 'cmt',
    '    // R52: รูปแบบใหม่ — body = "รอบส่งถัดไป <เวลาออกส่งจริง> …" (หัวข้อ/ไอคอนอยู่ฝั่ง strip)'],
  [(x) => x.includes('live.preOrderLine).toMatch('), 'matchLive',
    ["    expect(live.preOrderLine).toMatch(/^รอบส่งถัดไป /)",
     "    expect(live.preOrderLine).toContain('6:00 AM') // delivery_start 06:00 → เวลาออกส่งจริง"]],
])

// ---- r13 ----
fix('src/__tests__/r13RiderLoopClose.test.ts', [
  [(x) => x.includes('// R44 (Owner 2026-11-01): รูปแบบใหม่'), 'cmt',
    '    // R52 (Owner 2026-11-01): body ใหม่ "รอบส่งถัดไป <เวลาออกส่งจริง> …" (หัวข้อ/ไอคอนอยู่ฝั่ง strip)'],
  [(x) => x.includes("expect(s.preOrderLine).toContain('") && x.includes('รอบส่งถัดไป'), 'containPre',
    '    expect(s.preOrderLine).toMatch(/^รอบส่งถัดไป /)'],
  [(x) => x === "    expect(s.preOrderLine).toContain('เช้า')", 'name',
    ["    expect(s.preOrderLine).toContain('6:00 AM') // R52: delivery_start 06:00 → เวลาออกส่งจริง",
     "    expect(s.preOrderLine).not.toContain('เช้า') // R52: ชื่อรอบห้ามโชว์"]],
])

// verify markers
const musts = [
  ['src/__tests__/storeStatusWindow.test.ts', "not.toContain('รอบวันที่ 27')"],
  ['src/__tests__/storeStatusCopy.test.ts', "toContain('6:00 AM')"],
  ['src/__tests__/r13RiderLoopClose.test.ts', "not.toContain('เช้า')"],
]
for (const [p, m] of musts) {
  if (!fs.readFileSync(path.join(ROOT, p), 'utf8').includes(m)) throw new Error('verify ' + p + ' missing ' + m)
}
console.log('CM_C2 DONE + verified')