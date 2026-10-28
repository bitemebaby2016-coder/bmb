// R14 apply 167 (Owner 2026-10-28): batch id fix + summary created_at + confirm→confirmed hop
// + self-heal paid+pending (PO-20261028-135) ผ่าน transition canonical (jwt = Owner)
// Evidence → e2e/r14Apply167-result.json. Run: node e2e/r14Apply167.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const CLAIMS = JSON.stringify({ sub: 'dddf4b57-405f-4852-a985-76d8d52b1b72', role: 'authenticated', email: 'bitemebaby2016@gmail.com' })
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
const asOwner = (inner, end = 'COMMIT') =>
  "BEGIN; SELECT set_config('request.jwt.claims', '" + CLAIMS + "', true); SET LOCAL role authenticated; " + inner + ' ' + end + ';'
const FN = (name, args) =>
  "SELECT (position('99999999999' in pg_get_functiondef(p.oid)) > 0) AS overflow, " +
  "(position('created_at' in pg_get_functiondef(p.oid)) > 0) AS has_created_at, " +
  "(position('transition_order_status' in pg_get_functiondef(p.oid)) > 0) AS has_hop, " +
  "(position('::bigint::text' in pg_get_functiondef(p.oid)) > 0) AS uses_bigint " +
  "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace " +
  "WHERE n.nspname = 'public' AND p.proname = '" + name + "'" + (args ? " AND pg_get_function_identity_arguments(p.oid) = '" + args + "'" : '')

;(async () => {
  const out = { at: new Date().toISOString() }

  // stage 1: precheck
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    order135Before: await q("SELECT order_number, status, payment_status FROM public.orders WHERE order_number = 'PO-20261028-135'"),
    batchFn: await q(FN('create_production_batch', 'p_delivery_round_id text, p_scheduled_date date, p_order_mode text')),
    summaryFn: await q(FN('get_kitchen_summary')),
    confirmFn: await q(FN('confirm_offline_payment')),
  }

  // stage 2: apply
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '167_kitchen_batch_loop_fix.sql'), 'utf8')
  out.apply = await q(sql)

  // stage 3: heal paid+pending via canonical transition (as Owner)
  out.heal = await q(asOwner(
    "SELECT public.transition_order_status(o.order_number, 'confirmed') AS healed FROM public.orders o WHERE o.payment_status = 'paid' AND o.status = 'pending';"
  ))

  // stage 4: behavior proofs (create = ROLLBACK)
  out.probeCreate = await q(asOwner(
    "SELECT public.create_production_batch('round-20261028-evening', '2026-10-28', NULL);", 'ROLLBACK'
  ))
  out.probeSummary = await q(asOwner("SELECT public.get_kitchen_summary('2026-10-28');"))

  // stage 5: verify
  out.verify = {
    order135After: await q("SELECT order_number, status, payment_status FROM public.orders WHERE order_number = 'PO-20261028-135'"),
    batchFnAfter: await q(FN('create_production_batch', 'p_delivery_round_id text, p_scheduled_date date, p_order_mode text')),
    confirmFnAfter: await q(FN('confirm_offline_payment')),
    pipelineAfterHeal: await q("SELECT json_agg(t) FROM (SELECT order_number, status FROM public.orders WHERE status IN ('confirmed','preparing','ready_for_dispatch')) t"),
  }

  // stage 6: ledger
  out.record = {
    ins167: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('167','167_kitchen_batch_loop_fix','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  // assertions
  try {
    const batchId = JSON.parse(out.probeCreate)?.[0]?.create_production_batch?.batch_id || ''
    out.createAssertions = { batchId, digitsOk: /^batch-\d+-[0-9a-f]{6}$/.test(batchId), noHash: !batchId.includes('#'), noSpace: !batchId.includes(' ') }
  } catch (e) { out.createAssertions = { error: String(e).slice(0, 200), raw: String(out.probeCreate).slice(0, 400) } }
  try {
    const batches = JSON.parse(out.probeSummary)?.[0]?.get_kitchen_summary?.batches || []
    out.summaryAssertions = { batchCount: batches.length, created_atPresent: batches.every((b) => b.created_at != null), sample: batches[0] || null }
  } catch (e) { out.summaryAssertions = { error: String(e).slice(0, 200), raw: String(out.probeSummary).slice(0, 400) } }

  fs.writeFileSync(path.join(__dirname, 'r14Apply167-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))