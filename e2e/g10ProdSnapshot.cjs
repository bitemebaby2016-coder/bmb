// g10ProdSnapshot — G10 read-only production snapshot (NO writes, NO secret values)
// SELECT-only Management API + anon REST + public web fetch. Token: reverse-order (handoff rule 10).
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
const tokens = []
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) {
    if (m[1] === 'SUPABASE_ACCESS_TOKEN') tokens.push(m[2])
    else env[m[1]] = m[2]
  }
}
const REF = 'ivkdfognyiwjcmrhcnwz'
const snap = { checked_at: new Date().toISOString(), supabase_ref: REF }

async function withToken(fn) {
  for (const tok of [...tokens].reverse()) { // latest line first
    const res = await fn(tok)
    if (res && res.ok) return res.data
  }
  throw new Error('no working SUPABASE_ACCESS_TOKEN')
}

async function q(sql) {
  return withToken(async (tok) => {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json().catch(() => ({}))
    return { ok: r.ok, data: j }
  })
}

async function main() {
  // 1) Production web (public)
  const home = await fetch('https://biteme-baby.com/', { headers: { 'Cache-Control': 'no-cache' } })
  const html = await home.text()
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [null])[1]
  snap.web = { status: home.status, canonical: canon, canonical_ok: canon === 'https://biteme-baby.com/' }

  // 2) Edge functions — names only
  snap.edge_functions = await withToken(async (tok) => {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/functions', { headers: { Authorization: 'Bearer ' + tok } })
    const j = await r.json().catch(() => [])
    return { ok: r.ok, data: (Array.isArray(j) ? j : []).map((f) => ({ name: f.name, created_at: f.created_at })) }
  })

  // 3) Secrets — NAMES ONLY (never values)
  snap.secrets = await withToken(async (tok) => {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', { headers: { Authorization: 'Bearer ' + tok } })
    const j = await r.json().catch(() => [])
    const arr = Array.isArray(j) ? j : (j.secrets || [])
    const names = arr.map((s) => s.name).sort()
    return { ok: r.ok, data: { count: names.length, names, bmb_test_left: names.filter((n) => /^BMB_TEST_/.test(n)) } }
  })

  // 4) DB read-only — single-statement SELECTs only
  const queries = {
    tenancy: `select (select count(*)::int from public.tenants) tenants, (select count(*)::int from public.brands) brands, (select count(*)::int from public.branches) branches`,
    orders_by_source: `select coalesce(source_channel,'(null)') source_channel, count(*)::int n from public.orders group by 1 order by n desc`,
    orders_active: `select count(*)::int active from public.orders where status not in ('cancelled','delivered')`,
    delivery: `select (select count(*)::int from public.drivers) drivers, (select count(*)::int from public.delivery_zones) zones, (select count(*)::int from public.delivery_rounds) rounds, (select count(*)::int from public.delivery_rounds where status='active') active_rounds`,
    provider_orders: `select count(*)::int provider_orders from public.provider_orders`,
    social_events: `select coalesce(status,'(null)') status, count(*)::int n from public.social_events group by 1 order by 1`,
    automation_queue: `select coalesce(status,'(null)') status, count(*)::int n from public.automation_queue group by 1 order by 1`,
    push_subscriptions: `select count(*)::int n from public.push_subscriptions`,
    intake_signature: `select proname, pg_get_function_identity_arguments(oid) args from pg_proc where proname='create_order_with_items'`,
    create_order_def: `select pg_get_functiondef('public.create_order_with_items'::regproc) d`,
    fee_args: `select pg_get_function_identity_arguments('public.compute_delivery_fee'::regproc) args`,
    fee_def: `select pg_get_functiondef('public.compute_delivery_fee'::regproc) d`,
    window_def: `select pg_get_functiondef('public.enforce_pre_order_window'::regproc) d`,
    core_args: `select proname, pg_get_function_identity_arguments(oid) args from pg_proc where proname='create_order_with_items_core'`,
    helpers: `select proname from pg_proc where proname in ('has_service_role','append_audit_log','kitchen_location') order by proname`,
    settings_policy: `select key, branch_id, value from public.business_settings where key in ('delivery_policy','order_policy') order by key, (branch_id IS NULL)`,
    triggers: `select count(*)::int n from information_schema.triggers where trigger_schema='public'`,
    rls: `select count(*)::int rls_enabled_tables from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity`,
  }
  snap.db = {}
  for (const [k, sql] of Object.entries(queries)) {
    try { snap.db[k] = await q(sql) } catch (e) { snap.db[k] = { error: String(e.message || e).slice(0, 200) } }
  }

  // 5) intake single-signature check (mirror intakeDriftProbe — read-only)
  const entry = (snap.db.intake_signature || []).find((f) => f.proname === 'create_order_with_items')
  snap.intake_single_18param = !!(entry && entry.args.includes('p_source_channel') && entry.args.includes('p_external_ref_id') && entry.args.includes('p_customer_ref'))

  // 6) FC markers in current prod def (fcVerify114 intent, post-117)
  const def = String((snap.db.create_order_def || [{}])[0].d || '').replace(/\r\n/g, '\n')
  snap.fc_markers_in_prod_def = {
    fc1_branch_scoped_policy: def.includes('branch_id IS NULL OR branch_id = v_resolved_branch_id'),
    fc3_radius_override: def.includes('v_radius_override'),
    fc5_bitedrive_gate: def.includes('ERR_BITE_DRIVE_DISABLED'),
    fee_call_with_branch: /compute_delivery_fee\([^)]*v_resolved_branch_id\s*\)/s.test(def),
    external_methods_gate: def.includes('ERR_EXTERNAL_METHOD_DISABLED'),
    settings_driven_zone: def.includes('v_dp_setting'),
    hardcoded_500_literal: def.includes('5.00'),
    def_length: def.length,
  }

  // 7) remaining 114-era functions (should be intact — 117 only rewrote create_order_with_items)
  const feeDef = String((snap.db.fee_def || [{}])[0].d || '')
  const winDef = String((snap.db.window_def || [{}])[0].d || '')
  snap.fc114_remaining_markers = {
    fee_args: (snap.db.fee_args || [{}])[0].args,
    fee_has_branch_param: feeDef.includes('p_branch_id text DEFAULT NULL'),
    fee_uses_branch_radius: feeDef.includes('v_br'),
    window_cutoff_from_settings: winDef.includes(`order_setting('cutoff_hours', 2)`),
    core: (snap.db.core_args || []).map((f) => f.args),
    helpers: (snap.db.helpers || []).map((f) => f.proname),
  }

  const outPath = path.join(ROOT, 'e2e', 'g10-prod-snapshot.json')
  fs.writeFileSync(outPath, JSON.stringify(snap, null, 2))
  console.log('G10_PROD_SNAPSHOT_WRITTEN', outPath)
  console.log('web:', snap.web.status, 'canonical_ok=' + snap.web.canonical_ok)
  const efs = Array.isArray(snap.edge_functions) ? snap.edge_functions : (snap.edge_functions.data || [])
  console.log('edge_functions:', efs.length, efs.map((f) => f.name).join(','))
  const sec = snap.secrets.data || snap.secrets
  console.log('secrets:', sec.count, 'BMB_TEST_* left:', JSON.stringify(sec.bmb_test_left))
  console.log('intake_single_18param:', snap.intake_single_18param)
  console.log('fc_markers_in_prod_def:', JSON.stringify(snap.fc_markers_in_prod_def))
  console.log('fc114_remaining_markers:', JSON.stringify(snap.fc114_remaining_markers))
  console.log('settings_policy:', JSON.stringify(snap.db.settings_policy))
  console.log('orders_active:', JSON.stringify(snap.db.orders_active))
  console.log('orders_by_source:', JSON.stringify(snap.db.orders_by_source))
  console.log('tenancy:', JSON.stringify(snap.db.tenancy))
  console.log('delivery:', JSON.stringify(snap.db.delivery))
  console.log('provider_orders:', JSON.stringify(snap.db.provider_orders))
  console.log('social_events:', JSON.stringify(snap.db.social_events))
  console.log('automation_queue:', JSON.stringify(snap.db.automation_queue))
  console.log('push_subscriptions:', JSON.stringify(snap.db.push_subscriptions))
  console.log('triggers:', JSON.stringify(snap.db.triggers), 'rls:', JSON.stringify(snap.db.rls))
}
main().catch((e) => { console.error('ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
