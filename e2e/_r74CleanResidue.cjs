// ============================================
// BMB R74 — cleanup RESIDUE (ซากเทสต์ที่เหลือ: social_events + บัญชีเทสต์ + customer profiles)
//   · DRY-RUN default · --fire = ลบ · ห้ามแตะลูกค้าจริง/บัญชี harness (admin/qa หลัก)
// Usage: node e2e/_r74CleanResidue.cjs [--fire]
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const LOG = path.join(__dirname, '_r74_residue.log')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }
const FIRE = process.argv.includes('--fire')
const REF = 'ivkdfognyiwjcmrhcnwz'
const { SERVICE, api } = require('./wave2Lib.cjs')
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
  // ---- 1) เป้าหมาย: social_events เทสต์ ----
  const evWhere = "event_id like 'msg-r74%' or event_id like 'r74cmt%' or sender_id like 'r74-sim-%'"
  const evN = (await one('select count(*)::int as n from social_events where ' + evWhere)).n
  console.log('social_events test rows: ' + evN)

  // ---- 2) บัญชีเทสต์ (e2e<ts>@* / qa-r74*) — ไม่แตะ admin/qa หลักของ harness ----
  const users = (await q("select id, email from auth.users where email ~* '^e2e[0-9]|^qa-r74'")) || []
  const userIds = users.map((u) => u.id)
  const uidList = userIds.map(esc).join(',')
  console.log('test auth users: ' + users.length + ' (' + users.map((u) => String(u.email).split('@')[0]).join(', ') + ')')

  // ---- 3) customer rows ที่ผูกกับบัญชีเทสต์/identity เทสต์ ----
  const custCols = ((await q("select column_name from information_schema.columns where table_schema='public' and table_name='customers'")) || []).map((r) => r.column_name)
  console.log('customers columns: ' + custCols.join(','))
  const idWhere = "external_user_id like 'r74-sim-%'"
  const identRows = (await q('select customer_ref from customer_channel_identities where ' + idWhere)) || []
  const refList = identRows.map((r) => esc(r.customer_ref)).join(',')
  const linkCond = []
  if (uidList) linkCond.push('user_id in (' + uidList + ')')
  if (refList) linkCond.push('id in (' + refList + ')')
  linkCond.push("email ~* '^e2e[0-9]|^qa-r74' or full_name ~* '(r74 test|e2e[0-9]|ทดสอบ)'")
  const custWhere = '(' + linkCond.join(' or ') + ')'
  const custRows = (await q('select id, user_id from customers where ' + custWhere + ' limit 500')) || []
  console.log('customers test rows: ' + custRows.length)
  const combined = [...new Set([...userIds, ...custRows.map((r) => String(r.id)), ...identRows.map((r) => String(r.customer_ref))])]
  const combinedList = combined.map(esc).join(',')
  const custIdList = custRows.map((r) => esc(r.id)).join(',')
  console.log('customer_channel_identities test rows: ' + identRows.length)

  // ---- 4) ตารางที่ผูก customer (นับอย่างเดียว) ----
  const custTables = (await q("select distinct table_name from information_schema.columns where table_schema='public' and column_name in ('customer_ref','customer_id') and table_name not in ('orders','customers','customer_channel_identities')")) || []
  const linked = []
  for (const t of custTables.map((r) => r.table_name)) {
    for (const c of ['customer_ref', 'customer_id']) {
      const cols = ((await q("select 1 from information_schema.columns where table_schema='public' and table_name='" + t + "' and column_name='" + c + "'")) || [])
      if (!cols.length) continue
      const list = combinedList
      if (!list) continue
      const n = (await one('select count(*)::int as n from ' + t + ' where ' + c + ' in (' + list + ')')).n
      if (n > 0) linked.push({ t, c, n })
    }
  }
  console.log('linked customer tables: ' + JSON.stringify(linked))

  if (!FIRE) { console.log('\nDRY-RUN — รัน --fire เพื่อลบ: social_events(' + evN + ') + identities(' + identRows.length + ') + customers(' + custRows.length + ') + linked + auth users(' + users.length + ')'); return }

  // ---- 5) ลบ ----
  console.log('\n-- FIRE --')
  await q('delete from social_events where ' + evWhere)
  console.log('DELETE social_events test → recheck ' + (await one('select count(*)::int as n from social_events where ' + evWhere)).n)
  for (const { t, c, n } of linked) {
    const list = combinedList
    await q('delete from ' + t + ' where ' + c + ' in (' + list + ')')
    console.log('DELETE ' + t + '.' + c + ' (' + n + ') → recheck ' + (await one('select count(*)::int as n from ' + t + ' where ' + c + ' in (' + list + ')')).n)
  }
  if (custWhere) { await q('delete from customers where ' + custWhere); console.log('DELETE customers test → recheck ' + (await one('select count(*)::int as n from customers where ' + custWhere)).n) }
  await q('delete from customer_channel_identities where ' + idWhere)
  console.log('DELETE identities test → recheck ' + (await one('select count(*)::int as n from customer_channel_identities where ' + idWhere)).n)
  for (const u of users) {
    const r = await api(SERVICE, 'DELETE', '/auth/v1/admin/users/' + u.id)
    console.log('DELETE auth user ' + String(u.email).split('@')[0] + ' → ' + r.status)
  }
  console.log('RESIDUE_DONE')
})().catch((e) => { console.error('FATAL ' + String((e && e.stack) || e).slice(0, 800)); process.exit(1) })