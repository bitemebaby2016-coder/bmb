'use strict'
// _r73e_mk190.cjs — generate supabase/migrations/190_bkk_promo_gates_core.sql
// แบบกล 100%: extract body ของ create_order_with_items_core จาก 104 (verbatim) แล้ว
// เปลี่ยนเฉพาะบรรทัดวันที่ของ promo gate (pattern เดียวกับ m186) · assert ผลต่าง = 2 บรรทัด
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..', '..')
const src = fs.readFileSync(path.join(root, 'supabase', 'migrations', '104_b1_order_number_uniqueness.sql'), 'utf8').replace(/\r\n/g, '\n')
const lines = src.split('\n')

const start = lines.findIndex((l) => l.startsWith('CREATE OR REPLACE FUNCTION public.create_order_with_items_core('))
if (start < 0) { console.error('MK190_FAIL: create block not found'); process.exit(1) }
let end = -1
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].trim() === '$$;') { end = i; break }
}
if (end < 0) { console.error('MK190_FAIL: $$; not found'); process.exit(1) }

const body = lines.slice(start, end + 1)
const dateLines = body.filter((l) => l.includes('CURRENT_DATE'))
console.log('--- CURRENT_DATE lines inside extracted body ---')
dateLines.forEach((l) => console.log('  | ' + l.trim()))

const gateA = "       AND (start_date IS NULL OR start_date <= CURRENT_DATE)"
const gateB = "       AND (end_date IS NULL OR end_date >= CURRENT_DATE)"
const fixA = "       AND (start_date IS NULL OR start_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date)"
const fixB = "       AND (end_date IS NULL OR end_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date)"
const nA = body.filter((l) => l === gateA).length
const nB = body.filter((l) => l === gateB).length
const nLabel = body.filter((l) => l.includes("to_char(CURRENT_DATE, 'YYYYMMDD')")).length
if (nA !== 1 || nB !== 1 || nLabel !== 1) { console.error('MK190_FAIL: lines not unique nA=' + nA + ' nB=' + nB + ' nLabel=' + nLabel); process.exit(1) }
if (dateLines.length !== 3) { console.error('MK190_FAIL: expected exactly 3 CURRENT_DATE lines, got ' + dateLines.length); process.exit(1) }

const fixed = body.map((l) => {
  if (l === gateA) return fixA
  if (l === gateB) return fixB
  if (l.includes("to_char(CURRENT_DATE, 'YYYYMMDD')")) return l.replace('to_char(CURRENT_DATE,', 'to_char(v_round_date,')
  return l
})
if (fixed.some((l) => l.includes('CURRENT_DATE'))) { console.error('MK190_FAIL: residual CURRENT_DATE'); process.exit(1) }

const header = [
  '-- ============================================================',
  "-- Bite Me Baby — Migration 190: ปิดคลาส UTC/BKK date gate ตัวสุดท้ายของสายโปรโมชัน",
  '-- Date: 2026-11-06 · Owner สั่ง: "จัดการ promotion_apply_rules ดีเฟคที่ค้างให้พร้อม live"',
  '--',
  '-- Context: m186 (deployed) แก้ promotion_apply_rules + create_order_with_items แล้ว —',
  '--   เส้น live ทั้งหมด (_i -> create_order_with_items -> promotion_apply_rules) ใช้วัน BKK',
  '--   เหลือ create_order_with_items_core (m104 · ไม่มี caller ตั้งแต่ m173 แต่ยัง grant authenticated)',
  '--   ที่ gate โปรโมชันยังเทียบ CURRENT_DATE (UTC) = คูปองถูกมองข้ามเงียบ ๆ ช่วง 00:00–07:00 ICT',
  '--   หากมีการเรียก RPC นี้โดยตรง',
  '--',
  '-- FIX = body VERBATIM จาก 104_b1_order_number_uniqueness.sql (สร้างด้วย e2e/ci/_r73e_mk190.cjs)',
  '--   เปลี่ยน 3 บรรทัดวันที่: promo gate 2 บรรทัด -> (now() AT TIME ZONE \'Asia/Bangkok\')::date +',
  '--   ป้ายเลข order number -> to_char(v_round_date,...) (ตรงกับ canonical m173/186)',
  '--   (assertion/business rule คงเดิมทุกประการ · grant คงเดิม)',
  '-- Evidence: e2e/_r73e_verify_progress.log (repro gate เก่าด้วย extreme-timezone night-sim)',
  '-- ============================================================',
  'BEGIN;',
  ''
].join('\n')

const tail = [
  '',
  'COMMIT;',
  ''
].join('\n')

const out = header + fixed.join('\n') + tail
fs.writeFileSync(path.join(root, 'supabase', 'migrations', '190_bkk_promo_gates_core.sql'), out.replace(/\n/g, '\r\n'))
console.log('MK190_OK lines=' + fixed.length + ' out=' + path.join(root, 'supabase', 'migrations', '190_bkk_promo_gates_core.sql'))
