// R21e — gen migration 173 (to_char id fix): คัดลอก body ของ 3 function ที่ LIVE จริง
// จาก migration ต้นทางแบบ VERBATIM แล้วแทนที่เฉพาะบรรทัดสร้าง id ที่พัง:
//   · to_char(epoch_ms,'99999999999') 11 หลัก  →  overflow = '###########' + space นำ
//     (หลักฐาน production = e2e/r21eProdIdProbe.json: id 'ord- ###########-a04759')
//   · to_char(...,'99999999999999') 14 หลัก    →  space นำ ('osh-  1793…')
//   → fix pattern เดียวกับ R14/167 ที่พิสูจน์แล้ว: ((extract(epoch…) * 1000)::bigint)::text
// Function ที่แก้ (ตัวล่าสุดที่ define = ตัวที่ production ใช้อยู่):
//   A) create_order_with_items      ← 153 (307-630)
//   B) orders_notify_hook           ← 161 (13-94)
//   C) write_order_status_history   ← 040 (76-133)
// Run: node e2e/r21eGen173.cjs  (เขียนไฟล์ supabase/migrations/173_order_id_bigint_fix.sql)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const mig = (n) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', n), 'utf8').split(/\r?\n/)

// A ← 153
const a = mig('153_promotion_campaign_controls.sql')
const aStart = a.findIndex((l) => l.startsWith('CREATE OR REPLACE FUNCTION public.create_order_with_items('))
const aEnd = a.findIndex((l, i) => i > aStart && l.startsWith('GRANT EXECUTE ON FUNCTION public.create_order_with_items'))
if (aStart < 0 || aEnd < 0) throw new Error('A markers not found')
const A = a.slice(aStart, aEnd + 1)
const aOld = "  v_order_id := 'ord-' || to_char(extract(epoch from clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6);"
const aNew = "  v_order_id := 'ord-' || ((extract(epoch from clock_timestamp()) * 1000)::bigint)::text || '-' || substr(md5(random()::text), 1, 6);  -- 173: bigint::text (pattern R14/167) — to_char 11 หลักล้นเป็น '#' + space นำ"
if (A.filter((l) => l === aOld).length !== 1) throw new Error('A old id line not found exactly once')
const Afixed = A.map((l) => (l === aOld ? aNew : l))

// B ← 161
const b = mig('161_order_notifications_address_photo.sql')
const bStart = b.findIndex((l) => l.startsWith('CREATE OR REPLACE FUNCTION public.orders_notify_hook('))
const bEnd = b.findIndex((l, i) => i > bStart && l.trim() === '$$;')
if (bStart < 0 || bEnd < 0) throw new Error('B markers not found')
const B = b.slice(bStart, bEnd + 1)
const bOld = "  v_id := 'notif-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')"
const bNew = "  v_id := 'notif-' || ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)::text  -- 173: bigint::text — to_char 11 หลักล้นเป็น '#'"
if (B.filter((l) => l === bOld).length !== 1) throw new Error('B old id line not found exactly once')
const Bfixed = B.map((l) => (l === bOld ? bNew : l))

// C ← 040
const c = mig('040_order_status_history.sql')
const cStart = c.findIndex((l) => l.startsWith('CREATE OR REPLACE FUNCTION public.write_order_status_history('))
const cEnd = c.findIndex((l, i) => i > cStart && l.trim() === '$$;')
if (cStart < 0 || cEnd < 0) throw new Error('C markers not found')
const C = c.slice(cStart, cEnd + 1)
const cOld = "    'osh-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999999')"
const cNew = "    'osh-' || ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)::text  -- 173: bigint::text (14 nines คือ space นำ)"
if (C.filter((l) => l === cOld).length !== 1) throw new Error('C old id line not found exactly once')
const Cfixed = C.map((l) => (l === cOld ? cNew : l))

const header = [
  '-- ============================================',
  '-- 173 — R21e (Owner 2026-10-29): แก้ id จาก to_char overflow/padding = bigint::text',
  '-- ============================================',
  '-- หลักฐาน production (e2e/r21eProdIdProbe.json · ก่อนแก้):',
  "--   orders.id = 'ord- ###########-a04759' (11 nines ล้น → '#' + space นำ) · n_hash=8/8",
  "--   order_status_history.id = 'osh-  1793254847583-e150d20e' (14 nines → 2 space นำ)",
  "--   notifications ล่าสุด = 'evt-ord-…' (client path) — แต่ trigger hook 161 ยัง live อยู่",
  '--   (ทีมเห็นอาการเดียวกันที่ batch id = R14/167 แก้ด้วย bigint::text แล้วพิสูจน์ผ่าน contract 163)',
  '-- body = VERBATIM จากไฟล์ต้นทาง ( extract โดย e2e/r21eGen173.cjs ) — เปลี่ยนเฉพาะ',
  '--   บรรทัดสร้าง id 3 จุด · เรียงตามลำดับเลข migration ต้นทาง · re-run ปลอดภัย (CREATE OR REPLACE)',
  '-- ผล: id ใหม่ = <prefix>-<epoch_ms จริง 13 หลัก>-<md5> ไม่มี "#" ไม่มี space',
  '-- contract: e2e/contracts_153 G8 ตรวจ id ใหม่ห้ามมี [# ] (CI รันหลัง apply migrations ครบ)',
  '-- ============================================',
  '',
  '-- ---- A) create_order_with_items (body VERBATIM จาก 153 · เปลี่ยนเฉพาะ v_order_id) ----',
  '',
]
const midA = ['', '-- ---- B) orders_notify_hook (body VERBATIM จาก 161 · เปลี่ยนเฉพาะ v_id) ----', '']
const midB = ['', '-- ---- C) write_order_status_history (body VERBATIM จาก 040 · เปลี่ยนเฉพาะ osh- id) ----', '']
const out = [...header, ...Afixed, ...midA, ...Bfixed, ...midB, ...Cfixed, ''].join('\n')
const dest = path.join(ROOT, 'supabase', 'migrations', '173_order_id_bigint_fix.sql')
fs.writeFileSync(dest, out)
console.log('WROTE ' + dest)
console.log('A lines=' + Afixed.length + ' B lines=' + Bfixed.length + ' C lines=' + Cfixed.length)
console.log('checks: A_new=' + (out.includes(aNew) ? 'OK' : 'MISS') + ' B_new=' + (out.includes(bNew) ? 'OK' : 'MISS') + ' C_new=' + (out.includes(cNew) ? 'OK' : 'MISS'))
console.log('no_old_left: ' + (!out.includes(aOld) && !out.includes(bOld) && !out.includes(cOld)))
