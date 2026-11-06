'use strict'
// _r73e_mk191.cjs — generate supabase/migrations/191_kitchen_date_bkk.sql
// แบบกล 100%: extract 3 ฟังก์ชันครัวจาก 167 (verbatim) แล้วเปลี่ยนเฉพาะบรรทัดวันที่
// + ALTER TABLE defaults 2 จุด (delivery_rounds/production_batches.scheduled_date)
// = ปิดคลาส UTC date ที่เหลือ (คิวครัวผิดวัน 00:00-07:00 ICT)
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..', '..')
const src = fs.readFileSync(path.join(root, 'supabase', 'migrations', '167_kitchen_batch_loop_fix.sql'), 'utf8').replace(/\r\n/g, '\n')
const lines = src.split('\n')

function extractFn(name) {
  const start = lines.findIndex((l) => l.startsWith(`CREATE OR REPLACE FUNCTION public.${name}(`))
  if (start < 0) throw new Error('fn not found: ' + name)
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '$$;') return lines.slice(start, i + 1)
  }
  throw new Error('$$; not found for ' + name)
}

const fns = ['create_production_batch', 'kitchen_queue', 'get_kitchen_summary'].map(extractFn)
const body = fns.flat()
const dateLines = body.filter((l) => l.includes('CURRENT_DATE'))
console.log('--- CURRENT_DATE lines inside extracted bodies ---')
dateLines.forEach((l) => console.log('  | ' + l.trim()))

const subs = [
  ['  p_scheduled_date date DEFAULT CURRENT_DATE,', "  p_scheduled_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,", 1],
  ['  p_scheduled_date date DEFAULT CURRENT_DATE', "  p_scheduled_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date", 1],
  ['     WHERE pb.scheduled_date = COALESCE(p_scheduled_date, CURRENT_DATE)', "     WHERE pb.scheduled_date = COALESCE(p_scheduled_date, (now() AT TIME ZONE 'Asia/Bangkok')::date)", 1],
  ['  p_date date DEFAULT CURRENT_DATE', "  p_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date", 1],
]
let fixed = body
for (const [from, to, expect] of subs) {
  const n = fixed.filter((l) => l === from).length
  if (n !== expect) { console.error('MK191_FAIL: line not unique (' + n + '): ' + from.trim()); process.exit(1) }
  fixed = fixed.map((l) => (l === from ? to : l))
}
if (fixed.some((l) => l.includes('CURRENT_DATE'))) { console.error('MK191_FAIL: residual CURRENT_DATE'); process.exit(1) }
if (dateLines.length !== 4) { console.error('MK191_FAIL: expected 4 CURRENT_DATE lines, got ' + dateLines.length); process.exit(1) }

const header = [
  '-- ============================================================',
  '-- Bite Me Baby — Migration 191: ปิดคลาส UTC date ที่เหลือ (คิวครัวผิดวัน 00:00-07:00 ICT)',
  '-- Date: 2026-11-06 · Owner สั่ง: "ทำเรื่องค้างทั้งหมด" (ข้อ ① kitchen UTC defaults)',
  '--',
  '-- Context: fn ครัว 3 ตัว (m167 = latest) + table defaults 2 จุด ยัง fallback เป็น',
  "--   CURRENT_DATE (UTC session) = ช่วง 00:00-07:00 ICT คิวครัว/สรุปครัว/สร้าง batch",
  '--   มองเป็น "เมื่อวาน UTC" = คิวว่าง/ผิดวัน (time-bomb คลาสเดียวกับที่ m186/m190 ปิดไป)',
  '--',
  '-- FIX = 3 fn body VERBATIM จาก 167_kitchen_batch_loop_fix.sql (สร้างด้วย e2e/ci/_r73e_mk191.cjs)',
  "--   เปลี่ยนเฉพาะ 4 บรรทัดวันที่ (default x3 + COALESCE x1) -> (now() AT TIME ZONE 'Asia/Bangkok')::date",
  '--   + ALTER COLUMN scheduled_date SET DEFAULT (BKK) 2 ตาราง (fallback เดียวกัน · ทุกเส้น insert',
  '--     ส่งวันที่ explicit อยู่แล้ว = metadata-only ไม่เปลี่ยนพฤติกรรมของ caller)',
  '--   (assertion/business rule/grant คงเดิมทุกประการ)',
  '-- Evidence: e2e/_r73e_verify_progress.log (stage 2 prosrc/proargdefaults audit = 0 ทั้ง schema)',
  '-- ============================================================',
  'BEGIN;',
  ''
].join('\n')

const tail = [
  '',
  '-- ---- table defaults: fallback วันที่เดียวกัน (ทุก insert path ส่งค่า explicit อยู่แล้ว) ----',
  "ALTER TABLE public.delivery_rounds ALTER COLUMN scheduled_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date);",
  "ALTER TABLE public.production_batches ALTER COLUMN scheduled_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date);",
  '',
  'COMMIT;',
  ''
].join('\n')

const out = header + fixed.join('\n') + tail
fs.writeFileSync(path.join(root, 'supabase', 'migrations', '191_kitchen_date_bkk.sql'), out.replace(/\n/g, '\r\n'))
console.log('MK191_OK lines=' + fixed.length)
