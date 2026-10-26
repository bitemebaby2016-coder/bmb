// W-7 (Owner อนุมัติ 2026-10-26 — "อนุมัติ apply production 159") — apply migration 159 บน production
//   รันตามลำดับ: precheck → apply159 → verify → record
//   ผลแต่ละ stage = e2e/w7Apply159-<stage>.json (pattern เดียวกับ w6Apply157158.cjs / r16Apply156.cjs)
//   **production write ที่ได้รับอนุมัติ**: DROP legacy manual-era functions 6 ตัว (มี evidence ทุก stage)
const fs = require('fs')
const path = require('path')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'
const URL = 'https://' + REF + '.supabase.co'
const anon = (() => {
  for (const f of ['.env', '.env.local', '.env.production']) {
    if (!fs.existsSync(f)) continue
    const t = fs.readFileSync(f, 'utf8')
    const k = (/^VITE_SUPABASE_ANON_KEY=(.*)$/m.exec(t) || /^SUPABASE_ANON_KEY=(.*)$/m.exec(t) || [])[1]
    if (k) return k.trim().replace(/^["']|["']$/g, '')
  }
  return ''
})()
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, body: await r.text() }
}
const REST = {
  products: async () => {
    const r = await fetch(URL + '/rest/v1/products?select=id&limit=1', { headers: { apikey: anon, Authorization: 'Bearer ' + anon } })
    return { status: r.status, body: await r.text() }
  },
  rpcUpdateOrderStatus: async () => {
    const r = await fetch(URL + '/rest/v1/rpc/update_order_status', {
      method: 'POST',
      headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' },
      body: '{}',
    })
    return { status: r.status, body: await r.text() }
  },
}
const FNS = ['auto_approve_order', 'calculate_loyalty_points', 'check_product_availability', 'mark_payment_failed', 'update_order_status', 'validate_order_before_submit']
const EXPECT_ARGS = {
  auto_approve_order: '',
  calculate_loyalty_points: 'p_order_total numeric',
  check_product_availability: 'p_product_id uuid',
  mark_payment_failed: 'p_order_number text, p_reason text',
  update_order_status: '',
  validate_order_before_submit: '',
}
const FN_QUERY = `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (${FNS.map((f) => `'${f}'`).join(',')})
ORDER BY 1`
const stage = process.argv[2] || 'precheck'
const results = []
let assertFail = false
const log = (label, r) => {
  let parsed
  try { parsed = JSON.parse(r.body) } catch { parsed = String(r.body).slice(0, 600) }
  results.push({ label, status: r.status, data: parsed })
  console.log(`[${label}] status=${r.status} ${JSON.stringify(parsed).slice(0, 700)}`)
}
const assert = (ok, msg) => { if (!ok) { assertFail = true; console.log('ASSERT_FAIL ' + msg) } else { console.log('ASSERT_OK ' + msg) } }
const save = () => fs.writeFileSync(`e2e/w7Apply159-${stage}.json`, JSON.stringify(results, null, 2))
function hitsSafe(h) { return h.slice(0, 20) }
const scanCallers = () => {
  const hits = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (dir === 'supabase' && e.name === 'migrations') continue
        walk(p)
        continue
      }
      if (!/\.(ts|tsx|sql|js)$/.test(e.name)) continue
      if (p.includes('w7Apply159')) continue
      const t = fs.readFileSync(p, 'utf8')
      for (const f of FNS) {
        const re = new RegExp('\\b' + f + '\\s*\\(')
        if (re.test(t)) hits.push(p + ' :: ' + f)
      }
    }
  }
  if (fs.existsSync('src')) walk('src')
  if (fs.existsSync('supabase')) walk('supabase')
  return hits
}
// __PART2__
;(async () => {
  if (stage === 'precheck') {
    log('ledger-top', await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'))
    log('already-159', await q("SELECT version FROM supabase_migrations.schema_migrations WHERE version = '159'"))
    const fn = await q(FN_QUERY)
    log('six-functions-exist', fn)
    log('triggers-referencing-six', await q(
      `SELECT count(*) AS n FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN (${FNS.map((f) => `'${f}'`).join(',')}) AND NOT t.tgisinternal`))
    log('backup-recency', await q("SELECT count(*) AS recent FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
    const callers = scanCallers()
    results.push({ label: 'src-caller-scan', status: 200, data: { hits: hitsSafe(callers), count: callers.length } })
    console.log('[src-caller-scan] count=' + callers.length + ' ' + JSON.stringify(hitsSafe(callers)))
    let fnRows = []
    try { fnRows = JSON.parse(fn.body) } catch {}
    assert(fn.status < 400, 'functions query ok')
    assert(fnRows.length === 6, 'six functions exist (got ' + fnRows.length + ')')
    for (const row of fnRows) {
      assert((EXPECT_ARGS[row.proname] ?? '??') === row.args, `args match ${row.proname} = [${row.args}]`)
    }
    const trigN = results.find((r) => r.label === 'triggers-referencing-six').data?.[0]?.n
    assert(String(trigN) === '0', 'no triggers reference the six (got ' + trigN + ')')
    assert(callers.length === 0, 'src/supabase callers = 0')
    const already = results.find((r) => r.label === 'already-159').data
    assert(Array.isArray(already) && already.length === 0, '159 not applied yet')
    const top = results.find((r) => r.label === 'ledger-top').data?.[0]?.version
    assert(top === '158', 'ledger top = 158 (got ' + top + ')')
  } else if (stage === 'apply159') {
    log('apply-159', await q(fs.readFileSync('supabase/migrations/159_drop_legacy_manual_functions.sql', 'utf8')))
    const after = await q(FN_QUERY)
    log('functions-after-apply', after)
    let rows = []
    try { rows = JSON.parse(after.body) } catch {}
    assert(after.status < 400, 'functions query after apply ok')
    assert(rows.length === 0, 'six functions gone from pg_proc (got ' + rows.length + ')')
  } else if (stage === 'verify') {
    const fn = await q(FN_QUERY)
    log('functions-gone-verify', fn)
    let rows = []
    try { rows = JSON.parse(fn.body) } catch {}
    assert(rows.length === 0, 'pg_proc: 0 legacy functions remain')
    log('ledger-top-before-record', await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 2'))
    if (rows.length === 0) {
      log('rest-products-anon', await REST.products())
      const prod = results.find((r) => r.label === 'rest-products-anon')
      assert(prod.status === 200, 'PostgREST /products anon = 200 (storefront reads intact)')
      log('rest-rpc-update_order_status-gone', await REST.rpcUpdateOrderStatus())
      const rpc = results.find((r) => r.label === 'rest-rpc-update_order_status-gone')
      assert(rpc.status >= 400, 'PostgREST rpc/update_order_status = ' + rpc.status + ' (gone from API)')
    } else {
      results.push({ label: 'rest-smoke-skipped', status: 200, data: { reason: 'functions still present — skip rpc call' } })
      assert(false, 'cannot verify REST smoke because functions still exist')
    }
  } else if (stage === 'record') {
    log('record-159', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('159','159_drop_legacy_manual_functions','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4'))
    const hist = results.find((r) => r.label === 'history-after').data
    assert(Array.isArray(hist) && hist[0] && hist[0].version === '159', 'ledger top = 159 after record')
  } else {
    console.error('unknown stage')
    process.exit(1)
  }
  save()
  // 404 ของ rpc ที่ตั้งใจ check ว่า "หายแล้ว" = ผลที่ต้องการ ไม่นับเป็น bad
  const EXPECTED_4XX = ['rest-rpc-update_order_status-gone']
  const bad = results.filter((r) => r.status >= 400 && !EXPECTED_4XX.includes(r.label))
  const sqlErr = results.filter((r) => JSON.stringify(r.data).includes('ERROR:'))
  if (bad.length || sqlErr.length || assertFail) {
    console.log('STAGE_FAIL', stage, [...bad, ...sqlErr].map((b) => b.label).join(',') + (assertFail ? ',ASSERT' : ''))
    process.exitCode = 1
    return
  }
  console.log('STAGE_OK', stage)
})().catch((e) => { console.error(e); process.exit(1) })