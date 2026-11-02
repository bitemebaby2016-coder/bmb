// R52 cm_a — homeProviders.preOrderLine + storeStatusCopy default + AdminSettings help
// ใช้ ASCII anchors + escapes (display แปลง U+1F6F5 → อักขระจีน → editor match ไม่ติด)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const CAL = '\u{1F4C5}'
const L = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/)
const W = (p, l) => fs.writeFileSync(path.join(ROOT, p), l.join('\n'), 'utf8')

// ---- 1) homeProviders.preOrderLine: body ล้วน + delivery_start แทน display_name ----
{
  const p = 'src/lib/homeProviders.ts'
  const a = L(p)
  const s = a.findIndex((x) => x.includes('const preOrderLine = (() => {'))
  if (s < 0) throw new Error('hp start anchor')
  let e = -1
  for (let i = s; i < a.length; i++) { if (a[i].trim() === '})()') { e = i; break } }
  if (e < 0) throw new Error('hp end anchor')
  const nb = [
    '  const preOrderLine = (() => {',
    '    // R13/R18: กรอบ รอบ+วัน+ปิดรับคงเดิม (nextPre filter ไม่แตะ)',
    '    // R52 (Owner 2026-11-01): หัวข้อ/ไอคอนอยู่ฝั่ง strip — body ล้วน:',
    '    //   `รอบส่งถัดไป <เวลาออกส่ง AM/PM> <วัน DD/MM/YYYY> (ปิดรับ HH:MM AM/PM)`',
    '    //   แสดง "เวลาเดินทางออกส่ง" (delivery_start → 7:00 AM) แทนชื่อรอบ ("เช้า") ตามคำสั่ง Owner',
    "    const day = nextPre ? String(nextPre.scheduled_date ?? '').slice(0, 10) : ''",
    "    const dateLabel = /^\\d{4}-\\d{2}-\\d{2}$/.test(day)",
    '      ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`',
    "      : ''",
    "    // เวลาออกส่งจริง (ไม่ pad ชั่วโมง = 7:00 AM) · fallback ชื่อรอบถ้ารอบเก่าไม่มีเวลา",
    '    const depart =',
    '      nextPre && nextPre.delivery_start',
    "        ? fmtAmPm(String(nextPre.delivery_start)).replace(/^0/, '')",
    "        : nextPre?.display_name || 'รอบถัดไป'",
    '    return nextPre',
    "      ? `รอบส่งถัดไป ${depart}${dateLabel ? ` ${dateLabel}` : ''} (ปิดรับ ${fmtAmPm(roundCutoffLabel(nextPre, 'PRE_ORDER', 2))})`",
    "      : 'ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป'",
    '  })()',
  ]
  a.splice(s, e - s + 1, ...nb)
  W(p, a)
  console.log('OK cm_a homeProviders')
}

// ---- 2) storeStatusCopy.preOrderClosed = body ล้วน ----
{
  const p = 'src/lib/storeStatusCopy.ts'
  const a = L(p)
  const hits = a.map((x, i) => (x.includes("preOrderClosed: '") ? i : -1)).filter((i) => i >= 0)
  if (hits.length !== 1) throw new Error('preOrderClosed hits=' + hits.length)
  a[hits[0]] = "  // R52: หัวข้อ+ไอคอนอยู่ฝั่ง strip — คีย์นี้แก้ได้เฉพาะ \"เนื้อหา\" (ปิดรับแล้ว …)"
  a.splice(hits[0] + 1, 0, "  preOrderClosed: 'ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป',")
  W(p, a)
  console.log('OK cm_a storeStatusCopy')
}

// ---- 3) AdminSettings help line ----
{
  const p = 'src/pages/admin/AdminSettings.tsx'
  const a = L(p)
  const hits = a.map((x, i) => (x.includes('ป้ายพรีออเดอร์') ? i : -1)).filter((i) => i >= 0)
  if (hits.length !== 1) throw new Error('admin help hits=' + hits.length)
  a[hits[0]] = `              (เปลี่ยนจากที่นี่ไม่ได้) · ป้าย "${CAL} Pre-Order / จองล่วงหน้า : … รอบส่งถัดไป …" เป็นข้อมูลสดก็แก้ตรงนี้ไม่ได้{' '}`
  W(p, a)
  console.log('OK cm_a AdminSettings')
}
console.log('CM_A DONE')