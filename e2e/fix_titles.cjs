// temp: fix Thai test titles + collapse blank runs (DELETE before session end)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:/A PROJECT/Bite Me Baby'
const R = (p) => path.join(ROOT, p)
const read = (p) => fs.readFileSync(R(p), 'utf8')
const write = (p, s) => fs.writeFileSync(R(p), s, 'utf8')
let bad = 0
function replaceLine(file, match, replacement) {
  const lines = read(file).split('\n')
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) { lines[i] = replacement; n++ }
  }
  if (n !== 1) { console.log(`TITLE FAIL (${n}) ${file} :: ${match}`); bad++ }
  else { write(file, lines.join('\n')); console.log(`title ok: ${file}`) }
}
replaceLine(
  'src/__tests__/homeMenuAdminOrdering.test.ts',
  "it('ลำดับหมวด pinned",
  "  it('ลำดับหมวด = N-4 #7 (Owner 2026-10-26): ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → เครื่องดื่ม → ของทานเล่น/ผลไม้ → สำเร็จรูป (+ alias)', () => {",
)
replaceLine(
  'src/__tests__/categorySections.test.ts',
  "it('Feature B (Owner 2026-10-25)",
  "  it('Feature B (Owner 2026-10-26 · N-4 #7): หมวดติดลำดับ pinned (สินค้าสำเร็รูป) มาก่อนหมวดทั่วไป', async () => {",
)
replaceLine(
  'src/__tests__/categorySections.test.ts',
  '// ลำดับหัวข้อ = คำสั่ง Owner',
  '    // ลำดับหัวข้อ = N-4 #7 (Owner 2026-10-26): ส่งวันนี้→จองล่วงหน้า→สุขภาพ→...→สินค้าสำเร็รูป (modes ขึ้นก่อน sort_order)',
)
replaceLine(
  'src/__tests__/categorySections.test.ts',
  "it('Owner (2026-10-25)",
  "  it('Owner (2026-10-26 · N-4 #7): ชื่อจริงใน DB = ชื่อเล่นในลิสต์ pinned (ความหมายเดียวกัน) — เรียงได้จริง', async () => {",
)
for (const f of [
  'src/__tests__/menuTopTabs.test.ts',
  'src/__tests__/headingOrderFooter.test.ts',
  'src/__tests__/votePageUi.test.ts',
  'src/__tests__/preOrderLockUi.test.ts',
  'src/__tests__/uiTapScroll.test.ts',
]) {
  const s = read(f)
  const c = s.replace(/\n{3,}/g, '\n\n')
  if (c !== s) { write(f, c); console.log(`blank-collapse ${f} (-${s.length - c.length} chars)`) }
}
console.log(bad === 0 ? 'FIX OK' : `FIX BAD: ${bad}`)
process.exitCode = bad ? 1 : 0
