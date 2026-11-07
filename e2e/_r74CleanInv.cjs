// ============================================
// BMB R74 — test-data cleanup INVENTORY (READ-ONLY · ไม่แก้ DB อะไรทั้งสิ้น)
// สำรวจออเดอร์/ข้อมูลค้างจากทุกเซสชั่น AI → จำแนก test vs real ด้วยหลายสัญญาณ
//   - เต็มบันทึกลง e2e/_r74_cleanup_inventory.json (LOCAL ONLY — มี PII · ห้าม commit)
//   - บนจอ/ในแชท = แบบ mask เท่านั้น
// Usage: node e2e/_r74CleanInv.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

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

const maskName = (s) => (!s ? '' : String(s).slice(0, 2) + '…(' + String(s).length + ')')
const maskPhone = (s) => (!s ? '' : String(s).slice(0, 3) + '…' + String(s).slice(-2))

;(async () => {
  const out = { at: new Date().toISOString(), note: 'READ-ONLY inventory · LOCAL ONLY (PII)' }

  const cols = ((await q("select column_name from information_schema.columns where table_schema='public' and table_name='orders' order by ordinal_position")) || []).map((r) => r.column_name)
  out.orders_columns = cols
  console.log('orders columns: ' + cols.join(','))

  const byStatus = (await q('select status, count(*)::int as n from orders group by status order by n desc')) || []
  const bySource = (await q("select coalesce(source_channel,'(null)') as src, count(*)::int as n from orders group by 1 order by n desc")) || []
  const total = (await q('select count(*)::int as n, min(created_at) as mn, max(created_at) as mx from orders')) || []
  out.by_status = byStatus; out.by_source = bySource; out.total = total
  console.log('orders total: ' + JSON.stringify(total))
  console.log('by status: ' + JSON.stringify(byStatus))
  console.log('by source: ' + JSON.stringify(bySource))

  const want = ['id', 'order_number', 'status', 'created_at', 'customer_name', 'customer_phone', 'customer_ref', 'user_id', 'source_channel', 'external_ref_id', 'delivery_round_id', 'subtotal', 'total_amount', 'total', 'special_instructions', 'branch_id', 'order_mode']
  const sel = want.filter((c) => cols.includes(c))
  const orders = (await q('select ' + sel.join(',') + ' from orders order by created_at desc limit 3000')) || []
  out.orders = orders
  console.log('orders fetched: ' + orders.length)

  const users = (await q('select id, email, created_at from auth.users limit 3000')) || []
  const emailById = new Map(users.map((u) => [u.id, u.email]))
  const isTestEmail = (e) => !!e && /^(qa[-_.]|test[-_.]|e2e[-_.]|.*@(test|example|qa)\.)/i.test(String(e))
  out.test_users = users.filter((u) => isTestEmail(u.email)).map((u) => ({ email: u.email, created_at: u.created_at }))
  console.log('auth users: ' + users.length + ' · test-like: ' + out.test_users.length)

  const rounds = (await q("select id, status, scheduled_date, display_name from delivery_rounds where id like 'round-r74-%' or display_name like 'R74-OMNI%' order by scheduled_date desc")) || []
  out.test_rounds = rounds
  console.log('probe test rounds: ' + JSON.stringify(rounds))

  const artNums = new Set()
  const re = /\b(BMB-\d{8}-\d+|PO-\d{8}-\d+|TEST-ORDER-[A-Za-z0-9_-]+)\b/g
  for (const f of fs.readdirSync(__dirname)) {
    if (!/\.json$/.test(f) || /^_r74_cleanup/.test(f)) continue
    try {
      const txt = fs.readFileSync(path.join(__dirname, f), 'utf8')
      for (const m of txt.matchAll(re)) artNums.add(m[1])
    } catch {}
  }
  out.artifact_order_numbers = [...artNums]
  console.log('order numbers found in local e2e artifacts: ' + artNums.size)

  const artifactSet = artNums
  const strongName = /(ทดสอบ|test|qa|e2e|r74 commenter|wave2|dummy|sample)/i
  const strongPhone = /^(0{6,}|1{6,}|0000|0826096995|0811111111|0899999999)/
  const strongRef = /^(msg-r74|r74cmt-|test[-_]|e2e[-_]|TEST-ORDER)/i
  const classified = orders.map((o) => {
    const why = []
    const email = o.customer_ref ? emailById.get(o.customer_ref) : (o.user_id ? emailById.get(o.user_id) : null)
    if (/^TEST/i.test(String(o.order_number || ''))) why.push('order_number TEST-*')
    if (o.external_ref_id && strongRef.test(String(o.external_ref_id))) why.push('ext_ref=' + String(o.external_ref_id).slice(0, 24))
    if (email && isTestEmail(email)) why.push('test-account=' + String(email).split('@')[0].slice(0, 12))
    if (o.customer_name && strongName.test(String(o.customer_name))) why.push('name:' + String(o.customer_name).slice(0, 18))
    if (o.customer_phone && strongPhone.test(String(o.customer_phone))) why.push('phone:' + maskPhone(o.customer_phone))
    if (o.special_instructions && /ทดสอบ|test only|e2e/i.test(String(o.special_instructions))) why.push('special_instructions test')
    if (o.source_channel && /^(e2e|test|wave2|replay)/i.test(String(o.source_channel))) why.push('source=' + o.source_channel)
    if (o.delivery_round_id && /^round-r74-/.test(String(o.delivery_round_id))) why.push('probe-round')
    return {
      order_number: o.order_number, status: o.status, created_at: o.created_at,
      name_mask: maskName(o.customer_name), phone_mask: maskPhone(o.customer_phone),
      source: o.source_channel, ext_ref: o.external_ref_id, mode: o.order_mode,
      in_artifact: artifactSet.has(o.order_number), test: why.length > 0, why,
    }
  })
  out.classified = classified
  const tests = classified.filter((c) => c.test)
  out.summary = {
    total: classified.length,
    test: tests.length,
    real_or_unknown: classified.length - tests.length,
    test_by_status: tests.reduce((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {}),
  }
  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(out.summary))
  console.log('\n=== TEST candidates (mask แล้ว) ===')
  for (const c of tests.slice(0, 80)) {
    console.log([c.order_number, c.status, (c.created_at || '').slice(0, 16), c.name_mask, c.phone_mask, c.source || '-', 'why=' + c.why.join(' + ')].join(' | '))
  }
  if (tests.length > 80) console.log('... +' + (tests.length - 80) + ' more (ดูในไฟล์)')
  console.log('\n=== REAL/unknown sample 20 แถวแรก (mask แล้ว) ===')
  for (const c of classified.filter((x) => !x.test).slice(0, 20)) {
    console.log([c.order_number, c.status, (c.created_at || '').slice(0, 16), c.name_mask, c.phone_mask, c.source || '-'].join(' | '))
  }
  fs.writeFileSync(path.join(__dirname, '_r74_cleanup_inventory.json'), JSON.stringify(out, null, 2))
  console.log('\nsaved: e2e/_r74_cleanup_inventory.json (LOCAL ONLY)')
  console.log('INV_DONE')
})().catch((e) => { console.error('FATAL ' + String((e && e.stack) || e).slice(0, 800)); process.exit(1) })