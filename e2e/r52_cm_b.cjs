// R52 cm_b — StoreStatusStrip: comment + fallback + JSX 2 บรรทัด (label ใหม่จาก Owner)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const SC = '\u{1F6F5}'
const CAL = '\u{1F4C5}'
const BOLT = '\u26A1'
const p = 'src/components/home/StoreStatusStrip.tsx'
const a = fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/)
const idx = (pred, label) => {
  const hits = a.map((x, i) => (pred(x) ? i : -1)).filter((i) => i >= 0)
  if (hits.length !== 1) throw new Error(label + ' hits=' + hits.length)
  return hits[0]
}

// 1) comment block R44 → R52
{
  const s = idx((x) => x.includes('แสดงสถานะ 3 บรรทัด'), 'cmtStart')
  const e = idx((x) => x.includes('const sameDayLine = status.sameDayLine'), 'cmtEnd')
  const nb = [
    '  // R44/R52 (Owner 2026-11-01 "แสดงสถานะ 3 บรรทัด" · copy ใหม่ตาม R52):',
    '  //   1) ไฟสถานะเปิด-ปิด แจ้งทั้ง Pre-Order และ Same-Day ในบรรทัดเดียว',
    `  //   2) \`${CAL} Pre-Order / จองล่วงหน้า : ${SC} <เนื้อหาสด>\` — หัวข้อใน strip · body = รอบส่งถัดไป + เวลาออกส่งจริง`,
    '  //      ปิดรับ = fallback default แก้ผ่านคีย์ store_status_copy ได้',
    `  //   3) \`${BOLT} Same-Day / ส่งวันนี้ : ${SC} จัดส่งทันทีหลังปรุงเสร็จ\` (ยังไม่ถึงรอบ = "เริ่มส่ง HH:MM AM")`,
  ]
  a.splice(s, e - s, ...nb) // e = const preOrderLine line → replace [s, e)
}

// 2) fallback 'จัดส่งทันที' → 'จัดส่งทันทีหลังปรุงเสร็จ'
{
  const i = idx((x) => x.includes("sameDayOpen ? 'จัดส่งทันที'"), 'fallback')
  a[i] = "  const sameDayLine = status.sameDayLine ?? (sameDayOpen ? 'จัดส่งทันทีหลังปรุงเสร็จ' : 'ปิดรับแล้ว')"
}

// 3) JSX: comment ② + <p strip-preorder>
{
  const i1 = idx((x) => x.includes('R50 บรรทัด ②'), 'cmt2')
  a[i1] = '        {/* R52 บรรทัด 2: หัวข้อ Pre-Order/จองl่วงหน้า + เนื้อหาสด (เวลาออกส่งจริง ไม่ใช่ชื่อรอบ) · label อยู่ strip · ไม่ truncate */}'
  const i2 = idx((x) => x.includes('strip-preorder'), 'pPre')
  a[i2] = '        <p className="text-sm sm:text-base font-bold" data-testid="strip-preorder">' + CAL + ' Pre-Order / จองล่วงหน้า : ' + SC + ' {preOrderLine}</p>'
}

// 4) JSX: comment ③ + content sameday
{
  const i1 = idx((x) => x.includes('R50 บรรทัด ③'), 'cmt3')
  a[i1] = '        {/* R52 บรรทัด 3: หัวข้อ Same-Day/ส่งวันนี้ — ในหน้าต่างส่ง = จัดส่งทันทีหลังปรุงเสร็จ */}'
  const ip = idx((x) => x.includes('strip-sameday'), 'pSd')
  a[ip + 1] = '          ' + BOLT + ' Same-Day / ส่งวันนี้ : ' + SC + ' {sameDayLine}'
}

fs.writeFileSync(path.join(ROOT, p), a.join('\n'), 'utf8')

// VERIFY
const back = fs.readFileSync(path.join(ROOT, p), 'utf8')
if (!back.includes(CAL + ' Pre-Order / จองล่วงหน้า : ' + SC)) throw new Error('verify preorder label fail')
if (!back.includes(BOLT + ' Same-Day / ส่งวันนี้ : ' + SC)) throw new Error('verify sameday label fail')
if (!back.includes("sameDayOpen ? 'จัดส่งทันทีหลังปรุงเสร็จ'")) throw new Error('verify fallback fail')
if (back.includes('\u7535\u8f66')) throw new Error('CHINESE LEAK in strip!')
console.log('CM_B DONE + verified (scooter=U+1F6F5, no Chinese leak)')