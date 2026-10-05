// ============================================
// m116Apply — apply migration 116 (admin advance delivery) + verify (read-only)
//   node e2e/m116Apply.cjs            → apply
//   node e2e/m116Apply.cjs verify     → read-only surface checks
// Verification discipline: single-statement queries (Management API returns
// only the last statement's result), no fabricated orders.
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const PROJECT = 'ivkdfognyiwjcmrhcnwz'
const API = `https://api.supabase.com/v1/projects/${PROJECT}`
const SB = env.VITE_SUPABASE_URL || `https://${PROJECT}.supabase.co`
const ANON = env.VITE_SUPABASE_ANON_KEY || ''

async function query(sql) {
  const res = await fetch(`${API}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: res.status, json, text }
}

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

async function applyMigration() {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '116_admin_advance_delivery.sql'), 'utf8')
  const res = await query(sql)
  if (res.status >= 400 || (res.json && res.json.message)) {
    console.error('M116_APPLY_FAIL: HTTP ' + res.status + ' ' + JSON.stringify(res.json || res.text).slice(0, 1500))
    process.exit(1)
  }
  console.log('M116_APPLY_OK')
}

async function verify() {
  // 1) function def exists and is SECURITY DEFINER + is_admin gated
  const def = await query(`SELECT pg_get_functiondef('public.admin_advance_delivery_status(text,text)'::regprocedure) AS def`)
  const defText = (def.json && def.json[0] && def.json[0].def) || ''
  check('admin_advance_delivery_status exists',
    (def.status === 200 || def.status === 201) && Array.isArray(def.json) && defText.length > 0,
    `HTTP ${def.status} defLen=${defText.length}`)
  check('def is SECURITY DEFINER', defText.includes('SECURITY DEFINER'))
  check('def is admin-gated', defText.includes('is_admin()'))
  check('def has forward-only hop sync (order_transition_allowed)', defText.includes('order_transition_allowed'))
  check('def writes an audit trail (append_audit_log)', defText.includes('append_audit_log'))
  check('def labels the source as admin_advance_delivery_status', defText.includes('admin_advance_delivery_status'))
  check('def allow-list matches the driver RPC statuses',
    defText.includes("'picked_up', 'in_transit', 'delivered'"))
  check('def releases the driver after delivered', defText.includes("'available'"))

  // 2) anon must be refused (RLS/EXECUTE surface — live check)
  const r = await fetch(`${SB}/rest/v1/rpc/admin_advance_delivery_status`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_order_number: 'probe-nonexistent', p_status: 'delivered' }),
  })
  check('RPC refuses anon caller', r.status >= 400, `HTTP ${r.status}`)

  console.log(`--- M116_RESULT: ${pass} pass / ${fail} fail ---`)
  if (fail > 0) process.exit(1)
}

const mode = process.argv[2] || 'apply'
if (mode === 'verify') verify()
else applyMigration()