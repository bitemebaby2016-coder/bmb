// ============================================
// BMB R82h — ลบออเดอร์ทดสอบ (Owner 2026-11-08 "รายการออเดอร์ทดสอบที่สร้างขึ้นให้ลบหลังสร้างด้วย
//   ถ้าจะเก็บไว้ให้แยกออกไป")
//   เป้าหมายตามภาพ /admin/orders (พิสูจน์จาก evidence `_r82h_evidence.json` tail-match 4/4 · สถานะ = cancelled ทุกใบ):
//   BMB-20261108-484 (Social customer ฿166) + BMB-20261108-850/613/767 (R74 Test ฿87 ทุกใบ)
//   · DRY-RUN default = พิมพ์รายละเอียด+ provenance ให้เห็นก่อน · --fire = ลบจริง (มี backup ไฟล์ก่อนเสมอ)
//   · ลบ = order_items + payment ที่ผูกใบเดียวกัน (ไม่แตะ orders อื่น/ลูกค้าจริง/รอบส่ง)
// Usage: node e2e/_r82h_cleanOrders.cjs [--fire]
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const LOG = path.join(__dirname, '_r82h_cleanOrders.log')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {}; _log(...a) }
const FIRE = process.argv.includes('--fire')
const REF = 'ivkdfognyiwjcmrhcnwz'
const { SERVICE, api } = require('./wave2Lib.cjs')

const TARGET_NUMBERS = [
  'BMB-20261108-484',
  'BMB-20261108-850',
  'BMB-20261108-613',
  'BMB-20261108-767',
]

const MGMT_TOKENS = []
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*(bmb_PAT_SUPABASE_ACCESS_TOKEN|SUPABASE_ACCESS_TOKEN)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) MGMT_TOKENS.push(m[2])
}
async function q(sql) {
  for (const tok of [...MGMT_TOKENS].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) return j
  }
  return null
}
const one = async (sql) => ((await q(sql)) || [])[0]
const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'"

;(async () => {
  const nums = TARGET_NUMBERS.map(esc).join(',')
  const sql = 'select id, order_number, customer_ref, status, order_mode, total_amount, external_ref_id, created_at ' +
    'from orders where order_number in (' + nums + ') order by order_number'
  console.log('SQL: ' + sql)
  const rawOrders = await q(sql)
  if (!rawOrders) { console.log('RAW: null (management API ล้มเหลว — token?)'); process.exit(1) }
  if (rawOrders.length === 0) console.log('RAW: [] (query สำเร็จแต่ไม่ตรง — ดู probe _r82h_evidence)')
  const orders = rawOrders
  console.log('target orders found: ' + orders.length + '/' + TARGET_NUMBERS.length)
  if (orders.length === 0) { console.log('NOTHING_TO_DO'); return }

  // provenance: ชื่อลูกค้า + ว่ามี payment/intent อะไรผูกอยู่ (เห็นก่อนตัดสิน)
  const ids = orders.map((o) => esc(o.id)).join(',')
  const custIds = [...new Set(orders.map((o) => o.customer_ref).filter(Boolean))]
  const custs = custIds.length
    ? (await q('select id, full_name, phone, email from customers where id in (' + custIds.map(esc).join(',') + ')')) || []
    : []
  const items = (await q('select order_id, product_id, quantity, unit_price from order_items where order_id in (' + ids + ')')) || []
  const pis = (await q('select id, order_id, status, amount from payment_intents where order_id in (' + ids + ')')) || []
    .concat((await q('select id, order_id, status, amount from payments where order_id in (' + ids + ')')) || [])
  const dels = (await q('select id, order_id from delivery_assignments where order_id in (' + ids + ')')) || []
    .concat((await q('select id, order_id from order_transitions where order_id in (' + ids + ')')) || [])

  const custById = new Map(custs.map((c) => [c.id, c]))
  for (const o of orders) {
    const c = custById.get(o.customer_ref) || {}
    console.log('  ' + o.order_number + ' · ' + (c.full_name || '?') + (c.phone ? ' · ' + c.phone : '') +
      ' · ' + o.order_mode + ' · ฿' + o.total_amount + ' · status=' + o.status +
      ' · created=' + o.created_at + ' · ext=' + (o.external_ref || '-'))
  }
  console.log('related: order_items=' + items.length + ' payments/intents=' + pis.length +
    ' delivery/transition rows=' + dels.length)
  console.log('customers touched (rows only NOT deleted): ' + custs.map((c) => c.full_name).join(', '))

  if (!FIRE) { console.log('\nDRY-RUN — ไม่ได้แก้ไขอะไร · รัน --fire เพื่อลบ ' + orders.length + ' ใบ'); return }

  // ---- backup ก่อนลบ (กู้คืนได้) ----
  const backup = { at: new Date().toISOString(), orders, order_items: items, payments: pis, other: dels, customers: custs }
  const bpath = path.join(__dirname, '_r82h_orders_backup.json')
  fs.writeFileSync(bpath, JSON.stringify(backup, null, 2))
  console.log('backup → ' + bpath)

  console.log('\n-- FIRE --')
  for (const t of ['order_transitions', 'delivery_assignments', 'payments', 'payment_intents', 'order_items']) {
    const col = 'order_id'
    const has = (await q("select 1 from information_schema.columns where table_schema='public' and table_name='" + t + "' and column_name='" + col + "'")) || []
    if (!has.length) { console.log('skip ' + t + ' (ไม่มีคอลัมน์)'); continue }
    const n = (await one('select count(*)::int as n from ' + t + ' where ' + col + ' in (' + ids + ')')).n
    await q('delete from ' + t + ' where ' + col + ' in (' + ids + ')')
    console.log('DELETE ' + t + ' (' + n + ') → recheck ' + (await one('select count(*)::int as n from ' + t + ' where ' + col + ' in (' + ids + ')')).n)
  }
  await q('delete from orders where id in (' + ids + ')')
  const left = (await one('select count(*)::int as n from orders where id in (' + ids + ')')).n
  console.log('DELETE orders (' + orders.length + ') → recheck ' + left)
  console.log(left === 0 ? 'R82H_CLEAN_DONE' : 'R82H_CLEAN_PARTIAL')
})().catch((e) => { console.error('FATAL ' + String((e && e.stack) || e).slice(0, 800)); process.exit(1) })