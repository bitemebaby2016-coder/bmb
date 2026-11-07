// ============================================
// BMB R74 — cleanup SWEEP (ปิดจุดตกค้างหลัง --fire: child ที่ผูกด้วย order_id + ตรวจนับซากเทสต์อื่น)
//   · id ออเดอร์เทสต์มาจาก _r74_cleanup_inventory.json (out.orders[].id)
//   · ลบเฉพาะแถวที่ผูกกับ id/เลขที่ของ 26 ออเดอร์เทสต์ · ที่เหลือ = นับอย่างเดียว (รายงาน)
// Usage: node e2e/_r74CleanSweep.cjs [--fire]
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
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
const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'"

;(async () => {
  const inv = JSON.parse(fs.readFileSync(path.join(__dirname, '_r74_cleanup_inventory.json'), 'utf8'))
  const testRows = inv.orders.filter((o) => inv.classified.find((c) => c.order_number === o.order_number && c.test))
  const ids = testRows.map((o) => String(o.id))
  const nums = testRows.map((o) => o.order_number)
  const idList = ids.map(esc).join(',')
  const numList = nums.map(esc).join(',')
  console.log('sweep targets: ' + nums.length + ' orders / ' + ids.length + ' ids')

  // 1) child ที่ผูกด้วย order_id (ตารางเหล่านี้เคยนับได้เฉพาะ order_id = order_items เป็นต้น)
  for (const t of ['order_items', 'affiliate_attributions', 'points_ledger', 'production_batch_items', 'referral_attributions', 'referral_rewards']) {
    const before = ((await q('select count(*)::int as n from ' + t + ' where order_id in (' + idList + ')')) || [])[0]
    const n = before ? before.n : 'ERR'
    if (FIRE && Number(n) > 0) {
      await q('delete from ' + t + ' where order_id in (' + idList + ')')
      const after = ((await q('select count(*)::int as n from ' + t + ' where order_id in (' + idList + ')')) || [])[0]
      console.log('SWEEP ' + t + '.order_id: ' + n + ' -> ' + (after ? after.n : '?'))
    } else {
      console.log('SWEEP ' + t + '.order_id: ' + n + (Number(n) > 0 ? (FIRE ? '' : ' (dry-run — รัน --fire เพื่อลบ)') : ' (สะอาดแล้ว)'))
    }
  }
  // 2) ยืนยันซ้ำว่าไม่มีแถวเทสต์หลงเหลือในตารางหลัก
  for (const [t, c, list] of [
    ['orders', 'order_number', numList], ['order_status_history', 'order_number', numList], ['order_submissions', 'order_number', numList],
    ['payment_intents', 'order_number', numList], ['print_jobs', 'order_number', numList], ['points_ledger', 'order_number', numList],
  ]) {
    const r = ((await q('select count(*)::int as n from ' + t + ' where ' + c + ' in (' + list + ')')) || [])[0]
    console.log('CHECK ' + t + '.' + c + ' leftover: ' + (r ? r.n : 'ERR'))
  }
  // 3) นับซากเทสต์อื่น ๆ (รายงานอย่างเดียว — ยังไม่ลบ)
  const ev = ((await q("select count(*)::int as n from social_events where event_id like 'msg-r74%' or event_id like 'r74cmt%' or sender_id like 'r74-sim-%'")) || [])[0]
  const cust = ((await q("select count(*)::int as n from customers where customer_name ~* '(ทดสอบ|r74 test|e2e[0-9]|wave2|dummy)' or email ~* '^e2e|^qa-'")) || [])[0]
  const users = ((await q("select count(*)::int as n from auth.users where email ~* '^e2e[0-9]|^qa-r74'")) || [])[0]
  const carts = ((await q("select count(*)::int as n from cart_sessions where created_at < now() - interval '3 days'")) || [])[0]
  const total = ((await q('select count(*)::int as n from orders')) || [])[0]
  console.log('\n=== RESIDUE (ยังไม่ลบ — รายงาน) ===')
  console.log('social_events test rows: ' + (ev ? ev.n : 'ERR/n/a'))
  console.log('customers test rows: ' + (cust ? cust.n : 'ERR/n/a'))
  console.log('auth test users (e2e*/qa-r74): ' + (users ? users.n : 'ERR/n/a'))
  console.log('cart_sessions older than 3 days: ' + (carts ? carts.n : 'ERR/n/a'))
  console.log('orders total now: ' + (total ? total.n : 'ERR') + ' (ต้อง = 16 ของลูกค้าจริง)')
  console.log('SWEEP_' + (FIRE ? 'DONE' : 'DRYRUN'))
})().catch((e) => { console.error('FATAL ' + String((e && e.stack) || e).slice(0, 800)); process.exit(1) })