'use strict'
// _r73g_mk193.cjs — generate supabase/migrations/193_customers_crm_consent.sql
// แบบกล 100%: extract crm_winback_scan + crm_birthday_scan จาก 192 (verbatim) แล้ว
// เติมเงื่อนไข crm_consent = true (default false = ยังไม่ส่งใคร จนกว่าจะกดยินยอม)
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..', '..')
const src = fs.readFileSync(path.join(root, 'supabase', 'migrations', '192_crm_automation_and_sales_stats.sql'), 'utf8').replace(/\r\n/g, '\n')
const lines = src.split('\n')

function extractFn(name) {
  const start = lines.findIndex((l) => l.startsWith(`CREATE OR REPLACE FUNCTION public.${name}(`))
  if (start < 0) throw new Error('fn not found: ' + name)
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '$$;') return lines.slice(start, i + 1)
  }
  throw new Error('$$; not found for ' + name)
}

const fns = ['crm_winback_scan', 'crm_birthday_scan'].map(extractFn)
const body = fns.flat()
console.log('extracted lines=' + body.length)

const subs = [
  ['     WHERE t.last_order_at < now() - make_interval(days => v_days)',
   '     WHERE t.last_order_at < now() - make_interval(days => v_days)\n       AND c.crm_consent = true', 1],
  ['     WHERE birthday IS NOT NULL',
   '     WHERE birthday IS NOT NULL\n       AND crm_consent = true', 1],
]
let fixed = body
for (const [from, to, expect] of subs) {
  const n = fixed.filter((l) => l === from).length
  if (n !== expect) { console.error('MK193_FAIL: line not unique (' + n + '): ' + from.trim()); process.exit(1) }
  fixed = fixed.map((l) => (l === from ? to : l)).flat()
}
if (fixed.filter((l) => l.includes('crm_consent = true')).length !== 2) {
  console.error('MK193_FAIL: consent filter count != 2'); process.exit(1)
}

const header = [
  '-- ============================================================',
  '-- Bite Me Baby — Migration 193: customers.crm_consent + CRM scan ส่งเฉพาะคนยินยอม',
  '-- Date: 2026-11-06 · Owner สั่ง: "ทำเลย" (UI เก็บวันเกิด + consent)',
  '--',
  '-- Context: m192 เปิด winback/birthday scan = เริ่มส่งแจ้งเตือนทันที — ปิดความเสี่ยง',
  '--   ด้วย consent ที่ลูกค้ากดเองในหน้าบัญชี (ProfilePage · R73g): default false =',
  '--   ยังไม่ส่งใครเลย จนกว่าจะยินยอม · ถอนภายหลังได้ทุกเมื่อ (uncheck + บันทึก)',
  '--',
  '-- FIX = 2 fn body VERBATIM จาก 192_crm_automation_and_sales_stats.sql',
  '--   (สร้างด้วย e2e/ci/_r73g_mk193.cjs) เติมเงื่อนไข crm_consent = true ทั้งสอง scan',
  '--   + ALTER TABLE customers ADD COLUMN crm_consent (additive · default false)',
  '--   (business rule/grant คงเดิม · scan อื่น/segment summary ไม่แตะ)',
  '-- ============================================================',
  'BEGIN;',
  '',
  '-- ---- consent column (default false = ยังไม่ยินยอม = ยังไม่ส่งอะไร) ----',
  'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS crm_consent boolean NOT NULL DEFAULT false;',
  ''
].join('\n')

const out = header + fixed.join('\n') + '\n\nCOMMIT;\n'
fs.writeFileSync(path.join(root, 'supabase', 'migrations', '193_customers_crm_consent.sql'), out.replace(/\n/g, '\r\n'))
console.log('MK193_OK')
