// R52 cm_c1 — r44StatusStrip.test.ts อัปเดต assertions เป็น copy ใหม่
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const CAL = '\u{1F4C5}'
const BOLT = '\u26A1'
const p = 'src/__tests__/r44StatusStrip.test.ts'
const a = fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/)
const idx = (pred, label) => {
  const hits = a.map((x, i) => (pred(x) ? i : -1)).filter((i) => i >= 0)
  if (hits.length !== 1) throw new Error(label + ' hits=' + hits.length)
  return hits[0]
}

// 1) header comment 6 บรรทัด
{
  const t = idx((x) => x.includes('Bite Me Baby — R44 tests'), 'hdr')
  const s = t - 1 // ขึ้นต้นด้วย // ===
  const nb = [
    '// ============================================',
    '// Bite Me Baby — R44/R52 tests (Owner 2026-11-01): แถบสถานะหน้าแรก 3 บรรทัด',
    '//   1) ไฟสถานะเปิด-ปิด แจ้งทั้ง Pre-Order และ Same-Day ในบรรทัดเดียว',
    `//   2) ${CAL} Pre-Order / จองล่วงหน้า : รถncycles-placeholder รอบส่งถัดไป <เวลาออกส่ง> <วัน> (ปิดรับ …) — label ใน strip · body ใน provider`,
    `//   3) ${BOLT} Same-Day / ส่งวันนี้ : จัดส่งทันทีหลังปรุงเสร็จ · เริ่มส่ง HH:MM AM · ปิดรับแล้ว`,
    '// ============================================',
  ]
  // หาบรรทัดปิดหัว comment (=== ถัดไป)
  let e = -1
  for (let i = t; i < a.length; i++) { if (a[i] === '// ============================================') { e = i; break } }
  if (e < 0) throw new Error('hdr end')
  a.splice(s, e - s + 1, ...nb)
}

// 2) it title บรรทัด 3
{
  const i = idx((x) => x.includes('อยู่ในหน้าต่างส่ง (12:00'), 'it3t')
  a[i] = '  it(\'อยู่ในหน้าต่างส่ง (12:00 ในรอบเที่ยง 11-14) → "จัดส่งทันทีหลังปรุงเสร็จ"\', () => {'
}
// 3) toBe('จัดส่งทันที')
{
  const i = idx((x) => x.includes("expect(s.sameDayLine).toBe('จัดส่งทันที')"), 'toBe3')
  a[i] = "    expect(s.sameDayLine).toBe('จัดส่งทันทีหลังปรุงเสร็จ')"
}
// 4) it title บรรทัด 2
{
  const i = idx((x) => x.includes('<รอบ> <วัน> (ปิดรับ HH:MM AM/PM)"), () => {'), 'it2t')
  a[i] = '  it(\'Pre-Order body: รอบส่งถัดไป <เวลาออกส่ง AM/PM> <วัน> (ปิดรับ HH:MM AM/PM) — R52 หัวข้ออยู่ strip\', () => {'
}
// 5) toMatch(/^… + contain เวลาจริง
{
  const i = idx((x) => x.includes('expect(s.preOrderLine).toMatch(/^'), 'match')
  a.splice(i, 1,
    '    expect(s.preOrderLine).toMatch(/^รอบส่งถัดไป /)',
    "    expect(s.preOrderLine).toContain('11:00 AM') // R52: delivery_start ของรอบพรุ่งนี้ = เวลาออกส่งจริง",
  )
}
// 6) contain('เที่ยง') → not.toContain
{
  const i = idx((x) => x.includes("expect(s.preOrderLine).toContain('เที่ยง')"), 'name')
  a[i] = "    expect(s.preOrderLine).not.toContain('เที่ยง') // R52: ชื่อรอบห้ามโชว์แล้ว"
}
// 7) default preOrderClosed
{
  const i = idx((x) => x.includes('preOrderClosed).toContain('), 'defClosed')
  a[i] = "    expect(DEFAULT_STORE_STATUS_COPY.preOrderClosed).toBe('ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป')"
}
// 8) strip source labels (มี colon ตรง — แยกจาก assertion บรรทัด 1)
{
  const i = idx((x) => x.includes('stripSrc).toContain(') && x.includes("จองล่วงหน้า :'"), 'lbl2')
  a[i] = "    expect(stripSrc).toContain('" + CAL + " Pre-Order / จองล่วงหน้า :')"
}
{
  const i = idx((x) => x.includes('stripSrc).toContain(') && x.includes("รอบวันนี้/Same-Day :'"), 'lbl3')
  a.splice(i, 1,
    "    expect(stripSrc).toContain('" + BOLT + " Same-Day / ส่งวันนี้ :')",
    "    expect(stripSrc).not.toContain('รอบวันนี้/Same-Day :') // label เก่าถูกแทนแล้ว (บรรทัด 1 คง 'รอบวันนี้/Same-Day ⚡' เดิม)",
  )
}

fs.writeFileSync(path.join(ROOT, p), a.join('\n'), 'utf8')
const back = fs.readFileSync(path.join(ROOT, p), 'utf8')
for (const m of ["toMatch(/^รอบส่งถัดไป /)", "not.toContain('เที่ยง')", "toBe('ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป')", CAL + ' Pre-Order / จองล่วงหน้า :']) {
  if (!back.includes(m)) throw new Error('verify missing: ' + m)
}
if (back.includes('\u7535\u8f66')) throw new Error('CHINESE LEAK in r44 test!')
console.log('CM_C1 DONE + verified')