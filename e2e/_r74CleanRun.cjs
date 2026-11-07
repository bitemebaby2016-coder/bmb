// ============================================
// BMB R74 — test-data CLEANUP (ลบเฉพาะออเดอร์ "เทสต์ชัดเจน" เท่านั้น · ลูกค้าจริงห้ามแตะ)
//   · DRY-RUN default = สำรวจ FK + สำรองข้อมูล + แสดงแผนลบ (ไม่ลบอะไร)
//   · --fire = ลบตามแผน (backup แล้วเท่านั้น · order: child rows → orders → probe rounds)
//   · backup = e2e/_r74_cleanup_backup.json (LOCAL ONLY · ห้าม commit)
// Usage: node e2e/_r74CleanRun.cjs [--fire]
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

// log ผ่าน fs เสมอ (บทเรียน R74: detached context + cmd redirect)
const LOG = path.join(__dirname, '_r74_clean.log')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }

const FIRE = process.argv.includes('--fire')
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

;(async () => {
  // ---- 1) รายการเทสต์จาก inventory (test=true เท่านั้น) ----
  const inv = JSON.parse(fs.readFileSync(path.join(__dirname, '_r74_cleanup_inventory.json'), 'utf8'))
  const tests = inv.classified.filter((c) => c.test)
  const nums = tests.map((c) => c.order_number)
  console.log('test orders to remove: ' + nums.length)
  if (nums.length === 0) { console.log('no test orders — ไม่มีอะไรต้องลบ'); return }
  if (nums.length > 200) { console.log('ABORT: too many test candidates (' + nums.length + ') — ตรวจสอบ inventory ก่อน'); process.exit(1) }
  const numList = nums.map((n) => "'" + n.replace(/'/g, "''") + "'").join(',')
  // id ของออเดอร์เทสต์ (order_items ฯลฯ ผูกด้วย order_id = 'ord-...' ไม่ใช่เลขที่ออเดอร์)
  const ordRows0 = (await q('select id, order_number from orders where order_number in (' + numList + ')')) || []
  const ids = ordRows0.map((o) => String(o.id))
  const idList = ids.map((n) => "'" + n.replace(/'/g, "''") + "'").join(',')
  console.log('test order ids: ' + ids.length)

  // ---- 2) ค้นตารางที่มีคอลัมน์ผูกกับออเดอร์ ----
  const colRows = (await q("select table_name, column_name from information_schema.columns where table_schema='public' and (column_name in ('order_id','order_number','p_order_number','external_order_number') or column_name like '%order_number%') order by table_name")) || []
  const tables = {}
  for (const r of colRows) (tables[r.table_name] = tables[r.table_name] || []).push(r.column_name)
  console.log('tables with order-linked columns: ' + JSON.stringify(tables))
  const keyFor = (c) => (c === 'order_id' ? idList : numList)

  // ---- 3) นับแถว + สำรองข้อมูลก่อนลบ ----
  const backup = { at: new Date().toISOString(), note: 'LOCAL ONLY backup ก่อนลบออเดอร์เทสต์ · ห้าม commit', order_numbers: nums, order_ids: ids, tables: {} }
  for (const [t, cs] of Object.entries(tables)) {
    for (const c of cs) {
      const rows = (await q('select * from ' + t + ' where ' + c + ' in (' + keyFor(c) + ') limit 2000')) || []
      if (rows.length) {
        backup.tables[t + '.' + c] = rows
        console.log('backup ' + t + '.' + c + ': ' + rows.length + ' rows')
      }
    }
  }
  const ordRows = (await q('select * from orders where order_number in (' + numList + ')')) || []
  backup.tables['orders'] = ordRows
  console.log('backup orders: ' + ordRows.length + ' rows')
  // รอบเทสต์ของ probe (FK ชี้จาก delivery_round_id ของออเดอร์เทสต์)
  backup.tables['delivery_rounds'] = (await q("select * from delivery_rounds where id like 'round-r74-%'")) || []
  fs.writeFileSync(path.join(__dirname, '_r74_cleanup_backup.json'), JSON.stringify(backup, null, 2))
  console.log('backup saved: e2e/_r74_cleanup_backup.json (LOCAL ONLY)')

  if (!FIRE) {
    console.log('\nDRY-RUN — แผนลบ (ไม่ได้ลบอะไร):')
    for (const [t, cs] of Object.entries(tables)) {
      for (const c of cs) {
        const n = (backup.tables[t + '.' + c] || []).length
        if (n) console.log('  DELETE FROM ' + t + ' WHERE ' + c + ' IN (' + (c === 'order_id' ? '<26 order ids>' : '<26 order numbers>') + ') -- ' + n + ' rows')
      }
    }
    console.log('  DELETE FROM orders WHERE order_number IN (<26>) -- ' + ordRows.length + ' rows')
    console.log('  DELETE FROM delivery_rounds WHERE id LIKE \'round-r74-%\' -- ' + backup.tables['delivery_rounds'].length + ' rows')
    console.log('\nรันด้วย --fire เพื่อลบจริง')
    return
  }

  // ---- 4) ลบจริง (child → orders → rounds) ----
  let del = 0
  for (const [t, cs] of Object.entries(tables)) {
    for (const c of cs) {
      const rows = backup.tables[t + '.' + c] || []
      if (!rows.length) continue
      const r = await q('delete from ' + t + ' where ' + c + ' in (' + keyFor(c) + ')')
      console.log('DELETE ' + t + '.' + c + ' → ' + (r ? 'OK' : 'FAIL') + ' (' + rows.length + ' rows)')
      del += rows.length
    }
  }
  const rOrd = await q('delete from orders where order_number in (' + numList + ')')
  console.log('DELETE orders → ' + (rOrd ? 'OK' : 'FAIL') + ' (' + ordRows.length + ' rows)')
  const rRounds = await q("delete from delivery_rounds where id like 'round-r74-%'")
  console.log('DELETE delivery_rounds round-r74-* → ' + (rRounds ? 'OK' : 'FAIL') + ' (' + backup.tables['delivery_rounds'].length + ' rows)')

  // ---- 5) verify ----
  const after = (await q('select status, count(*)::int as n from orders group by status order by n desc')) || []
  const left = (await q("select count(*)::int as n from orders where order_number in (" + numList + ')')) || []
  const roundsLeft = (await q("select count(*)::int as n from delivery_rounds where id like 'round-r74-%'")) || []
  console.log('\n=== VERIFY ===')
  console.log('orders by status now: ' + JSON.stringify(after))
  console.log('test orders left: ' + JSON.stringify(left) + ' · probe rounds left: ' + JSON.stringify(roundsLeft))
  console.log('CLEANUP_' + ((left[0] && left[0].n === 0 && roundsLeft[0] && roundsLeft[0].n === 0) ? 'DONE' : 'INCOMPLETE'))
})().catch((e) => { console.error('FATAL ' + String((e && e.stack) || e).slice(0, 800)); process.exit(1) })