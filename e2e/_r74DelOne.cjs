// ============================================
// BMB R74 — ลบออเดอร์ตามใบสั่ง Owner (คำสั่งเฉพาะกิจ · backup ก่อนเสมอ)
//   · DRY-RUN default = แสดงแผน + สำรอง · --fire = ลบจริง
//   · ลบไม่ได้ (ติด FK/เงื่อนไข) → fallback ย้ายไป cancelled ด้วย cancel_order (canonical)
//   · backup = e2e/_r74_cleanup_backup_delone.json (LOCAL ONLY · ห้าม commit)
// Usage: node e2e/_r74DelOne.cjs BMB-20261101-548 [--fire]
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const LOG = path.join(__dirname, '_r74_delone.log')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }

const args = process.argv.slice(2)
const FIRE = args.includes('--fire')
const nums = args.filter((a) => !a.startsWith('--'))
if (nums.length === 0) { console.log('ระบุเลขที่ออเดอร์อย่างน้อย 1 รายการ'); process.exit(1) }

const REF = 'ivkdfognyiwjcmrhcnwz'
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
const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'"

;(async () => {
  const numList = nums.map(esc).join(',')
  // ---- 1) ตรวจออเดอร์เป้าหมาย + แสดงแบบ mask ----
  const rows = (await q('select id, order_number, status, payment_status, created_at, left(customer_name,2) as nm, source_channel from orders where order_number in (' + numList + ')')) || []
  for (const r of rows) console.log('target: ' + r.order_number + ' | ' + r.status + ' | pay=' + r.payment_status + ' | ' + String(r.created_at).slice(0, 16) + ' | ' + r.nm + '… | ' + r.source_channel)
  const missing = nums.filter((n) => !rows.some((r) => r.order_number === n))
  if (missing.length) console.log('ไม่เจอในระบบ (ข้าม): ' + missing.join(', '))
  if (rows.length === 0) { console.log('ไม่มีเป้าหมายให้ลบ'); return }
  const idList = rows.map((r) => esc(String(r.id))).join(',')
  const keyFor = (c) => (c === 'order_id' ? idList : numList)

  // ---- 2) ตารางที่ผูกกับออเดอร์ ----
  const colRows = (await q("select table_name, column_name from information_schema.columns where table_schema='public' and (column_name in ('order_id','order_number','p_order_number','external_order_number') or column_name like '%order_number%') order by table_name")) || []
  const tables = {}
  for (const r of colRows) (tables[r.table_name] = tables[r.table_name] || []).push(r.column_name)

  // ---- 3) backup ก่อนลบ (ทุกมิติ) ----
  const backup = { at: new Date().toISOString(), note: 'LOCAL ONLY backup ก่อนลบออเดอร์ตามใบสั่ง Owner · ห้าม commit', order_numbers: nums, order_ids: rows.map((r) => String(r.id)), tables: {} }
  for (const [t, cs] of Object.entries(tables)) {
    for (const c of cs) {
      const found = (await q('select * from ' + t + ' where ' + c + ' in (' + keyFor(c) + ') limit 2000')) || []
      if (found.length) {
        backup.tables[t + '.' + c] = found
        console.log('backup ' + t + '.' + c + ': ' + found.length + ' rows')
      }
    }
  }
  backup.tables['orders'] = (await q('select * from orders where order_number in (' + numList + ')')) || []
  fs.writeFileSync(path.join(__dirname, '_r74_cleanup_backup_delone.json'), JSON.stringify(backup, null, 2))
  console.log('backup saved: e2e/_r74_cleanup_backup_delone.json (LOCAL ONLY)')
  if (!FIRE) {
    console.log('\nDRY-RUN — แผนลบ child ทุกมิติ -> orders (' + rows.length + ' ใบ) · ถ้าลบไม่ได้ = fallback cancel_order')
    console.log('รันซ้ำพร้อม --fire เพื่อลบจริง')
    return
  }

  // ---- 4) ลบจริง: child (ทุกมิติ) -> orders ----
  console.log('\n-- FIRE --')
  for (const [t, cs] of Object.entries(tables)) {
    for (const c of cs) {
      const n = (backup.tables[t + '.' + c] || []).length
      if (!n) continue
      await q('delete from ' + t + ' where ' + c + ' in (' + keyFor(c) + ')')
      const left = ((await q('select count(*)::int as n from ' + t + ' where ' + c + ' in (' + keyFor(c) + ')')) || [])[0]
      console.log('DELETE ' + t + '.' + c + ' (' + n + ') → left ' + (left ? left.n : 'ERR'))
    }
  }
  await q('delete from orders where order_number in (' + numList + ')')
  const leftOrd = ((await q('select count(*)::int as n from orders where order_number in (' + numList + ')')) || [])[0]
  console.log('DELETE orders (' + rows.length + ') → left ' + (leftOrd ? leftOrd.n : 'ERR'))

  // ---- 5) ถ้ายังลบไม่ได้ = fallback ย้ายไป cancelled (cancel_order canonical) ----
  if (leftOrd && leftOrd.n > 0) {
    console.log('ลบไม่ได้ ' + leftOrd.n + ' ใบ → fallback cancel_order (ย้ายไปแท็บ Cancelled)')
    const { S, login, rpc } = require('./wave2Lib.cjs')
    const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
    if (admin.status === 200) {
      for (const r of rows) {
        const c = await rpc(admin.jwt, 'cancel_order', { p_order_number: r.order_number, p_reason: 'Owner approved special-case cleanup 2026-11-07' })
        console.log('cancel_order ' + r.order_number + ' → ' + c.status)
      }
    } else {
      console.log('admin login failed ' + admin.status + ' — ยัง cancel ไม่ได้')
    }
    const fin = ((await q('select count(*)::int as n from orders where order_number in (' + numList + ') and status != ' + esc('cancelled'))) || [])[0]
    console.log('after fallback: non-cancelled left = ' + (fin ? fin.n : 'ERR'))
  }
  console.log('DELONE_DONE')
})().catch((e) => { console.error('FATAL ' + String((e && e.stack) || e).slice(0, 800)); process.exit(1) })