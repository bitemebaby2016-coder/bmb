// ============================================
// m119ApplyVerify — apply migration 119 (fix bmb-images storage policies) + verify
//   node e2e/m119ApplyVerify.cjs apply   → apply
//   node e2e/m119ApplyVerify.cjs verify  → read-only checks
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(\w+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) env[m[1]] = m[2]
}
const TOKENS = [env.SUPABASE_ACCESS_TOKEN].filter(Boolean)
const PROJECT = 'ivkdfognyiwjcmrhcnwz'
const API = `https://api.supabase.com/v1/projects/${PROJECT}`

async function query(sql) {
  let last = ''
  for (const tok of [...TOKENS].reverse()) {
    const res = await fetch(`${API}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* non-JSON */ }
    if (res.ok) return { status: res.status, json, text }
    if (res.status === 401 || res.status === 403) { last = 'HTTP ' + res.status; continue }
    return { status: res.status, json, text }
  }
  return { status: 0, json: null, text: last || 'no token' }
}

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

async function applyMigration() {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '119_fix_bmb_images_storage_policies.sql'), 'utf8')
  const res = await query(sql)
  if (res.status >= 400 || (res.json && res.json.message)) {
    console.error('M119_APPLY_FAIL: HTTP ' + res.status + ' ' + JSON.stringify(res.json || res.text).slice(0, 1500))
    process.exit(1)
  }
  console.log('M119_APPLY_OK')
}

async function verify() {
  const r = await query(`select policyname, cmd, with_check, qual from pg_policies where schemaname='storage' and tablename='objects' order by policyname`)
  const rows = (r.json && Array.isArray(r.json)) ? r.json : []
  check('storage.objects policies readable', (r.status === 200 || r.status === 201) && rows.length >= 4, `HTTP ${r.status} rows=${rows.length}`)
  const get = (n) => rows.find((p) => p.policyname === n)
  const up = get('bmb_images_authenticated_upload')
  check('bmb_images_authenticated_upload exists', !!up, up ? up.cmd : 'missing')
  check('upload with_check uses bucket literal (no buckets subquery)',
    !!up && /bucket_id\s*=\s*'bmb-images'/.test(up.with_check || '') && !/storage\.buckets/.test(up.with_check || ''),
    up ? String(up.with_check).slice(0, 90) : 'missing')
  const rd = get('bmb_images_public_read')
  check('bmb_images_public_read uses bucket literal',
    !!rd && /bucket_id\s*=\s*'bmb-images'/.test(rd.qual || '') && !/storage\.buckets/.test(rd.qual || ''),
    rd ? String(rd.qual).slice(0, 90) : 'missing')
  const ud = get('bmb_images_admin_update')
  check('bmb_images_admin_update admin-gated', !!ud && /'admin'/.test(ud.qual || ''), ud ? String(ud.qual).slice(0, 90) : 'missing')
  const dl = get('bmb_images_admin_delete')
  check('bmb_images_admin_delete admin-gated', !!dl && /'admin'/.test(dl.qual || ''), dl ? String(dl.qual).slice(0, 90) : 'missing')
  console.log(`--- M119_RESULT: ${pass} pass / ${fail} fail ---`)
  if (fail > 0) process.exit(1)
}

const mode = process.argv[2] || 'apply'
if (mode === 'verify') verify()
else applyMigration()
