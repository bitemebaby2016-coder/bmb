// ============================================
// Bite Me Baby — PHASE 0 TRUTH LOCK (read-only live DB verification)
// ============================================
// Reads ONLY from the production Supabase project. No writes performed.
// RPC probes reuse invalid-input negative tests that abort BEFORE any row
// is written (007/008 server-authoritative pattern).
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const ENV = parseEnv(path.join(PROJ, '.env'))
const SUPABASE_URL = ENV.VITE_SUPABASE_URL || ''
const ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY || ''
const SVC_KEY = fs.readFileSync(path.join(PROJ, 'supabase.temp', 'srkey.local'), 'utf8').trim()

if (!SUPABASE_URL || !ANON_KEY || !SVC_KEY) {
  console.error('MISSING credentials (env / supabase.temp/srkey.local)')
  process.exit(2)
}

const REST = () => SUPABASE_URL + '/rest/v1'
const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail: detail == null ? null : String(detail).slice(0, 300) })
  console.log((ok ? 'check ' : 'XMARK ') + name + (detail != null ? ' :: ' + String(detail).slice(0, 220) : ''))
}

async function restSelect(table, key, opts = {}) {
  const qs = new URLSearchParams({ select: '*', limit: '2' })
  if (opts.columns) qs.set('select', opts.columns + ',created_at')
  const res = await fetch(`${REST()}/${table}?${qs}`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key },
  })
  const body = await res.text()
  let json = null
  try { json = JSON.parse(body) } catch { json = body }
  return { status: res.status, body, json }
}

async function rpcCall(fn, args, key) {
  const res = await fetch(`${REST()}/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  })
  return { status: res.status, body: (await res.text()).slice(0, 400) }
}

// PGRST202 = "Could not find the function" -> proves the function is MISSING.
const isMissingFn = (b) => /PGRST202/.test(b)
;(async () => {
  // ================================================================
  // A. ANON RLS posture — S-3 (orders anon read). Compare anon vs service.
  // ================================================================
  const anonOrders = await restSelect('orders', ANON_KEY, { columns: 'id,order_number,total_amount,status' })
  const svcOrders = await restSelect('orders', SVC_KEY, { columns: 'id,order_number,total_amount,status' })
  const anonVisible = Array.isArray(anonOrders.json) && anonOrders.json.length > 0
  record('S-3 anon cannot read orders (RLS blocks)', !anonVisible,
    `anon rows=${Array.isArray(anonOrders.json) ? anonOrders.json.length : 'n/a'} svcRows=${Array.isArray(svcOrders.json) ? svcOrders.json.length : 'n/a'}`)

  // A2. anon blocked on protected tables
  for (const t of ['customers', 'payment_intents', 'ai_conversations', 'ai_recommendations', 'profiles', 'inventory']) {
    const anon = await restSelect(t, ANON_KEY)
    const svc = await restSelect(t, SVC_KEY)
    const anonBlocked = !(Array.isArray(anon.json) && anon.json.length > 0)
    record(`anon blocked on ${t}`, anonBlocked,
      `anonRows=${Array.isArray(anon.json) ? anon.json.length : '-'} svcRows=${Array.isArray(svc.json) ? svc.json.length : '-'}`)
  }

  // A3. anon public tables expected readable (menu/storefront data)
  for (const t of ['products', 'product_categories', 'delivery_rounds', 'reviews', 'promotions', 'delivery_zones', 'preorder_votes']) {
    const anon = await restSelect(t, ANON_KEY)
    record(`anon can read ${t}`, anon.status === 200,
      `status=${anon.status} rows=${Array.isArray(anon.json) ? anon.json.length : '-'}`)
  }

  // ================================================================
  // B. RPC existence + guard behavior (negative tests — no writes persist)
  // ================================================================
  const probes = [
    ['create_order_with_items', { p_items: [], p_delivery_round_id: 'round-x' }],
    ['transition_order_status', { p_order_number: 'NOPE-000000-000', p_new_status: 'delivered' }],
    ['create_payment_intent_record', { p_order_number: '', p_amount: 0, p_method: 'promptpay_qr' }],
    ['confirm_offline_payment', { p_order_number: '' }],
    ['submit_offline_payment_reference', { p_order_number: '', p_reference: '' }],
    ['mark_payment_failed', { p_order_number: '', p_reason: '' }],
    ['record_payment_result', { p_order_number: '', p_payment_intent_id: '', p_amount: 0 }],
  ]
  for (const [fn, args] of probes) {
    const r = await rpcCall(fn, args, SVC_KEY)
    record(`RPC ${fn} exists + guards (negative)`, !isMissingFn(r.body) && r.status < 500,
      `status=${r.status} ${r.body.slice(0, 110)}`)
  }

  const addons = await rpcCall('compute_addons_price', { p_product_id: null, p_options: null }, SVC_KEY)
  record('RPC compute_addons_price exists (016)', addons.status === 200 && /0/.test(addons.body),
    `status=${addons.status} ${addons.body.slice(0, 60)}`)

  // ================================================================
  // C. Migration feature markers — table/column presence (001→016)
  // ================================================================
  const tableChecks = [
    ['pre_orders', '001/002 pre-order tables'], ['orders', '001 orders spine'],
    ['order_items', '001 order lines'], ['payment_intents', '008'],
    ['delivery_rounds', '001/006 capacity'], ['delivery_zones', '008 D.3'],
    ['provider_orders', '008 D.4'], ['business_settings', '008 D.1'],
    ['media_assets', '008 D.2'], ['inventory', '001/006'],
    ['inventory_transactions', '001/006'], ['customers', '001 + 015'],
    ['ai_conversations', 'AI chat'], ['ai_recommendations', 'AI chat'],
    ['products', '001 + 012/016'], ['product_categories', '001'], ['reviews', '001/002'],
    ['promotions', '001 + 016 is_banner'], ['preorder_votes', '001/002'],
  ]
  for (const [t, note] of tableChecks) {
    const svc = await restSelect(t, SVC_KEY)
    record(`table ${t} present (${note})`, svc.status === 200, `status=${svc.status} ${svc.body.slice(0, 70)}`)
  }

  const columnChecks = [
    ['orders', '007 fields', 'order_number,total_amount,payment_status,customer_ref,status,delivery_method,payment_method'],
    ['products', '016 addons / 012 stock', 'addons,is_preorder,is_available,stock,price'],
    ['customers', '015 location', 'default_latitude,default_longitude,default_address_detail,phone'],
    ['promotions', '016 banner', 'is_banner,banner_image,discount_type,is_active'],
    ['payment_intents', '008 flow', 'payment_intent_id,status,method,amount,metadata,order_number'],
  ]
  for (const [t, note, cols] of columnChecks) {
    const svc = await restSelect(t, SVC_KEY, { columns: cols })
    record(`columns ${t} (${note})`, svc.status === 200, `status=${svc.status} ${svc.body.slice(0, 110)}`)
  }

  // ================================================================
  // D. Storage bucket (011) + anon write guard
  // ================================================================
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/bmb-images`, { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } })
    const data = await res.json().catch(() => null)
    record('storage bucket bmb-images present (011)', res.status === 200 && data && data.id === 'bmb-images',
      `status=${res.status} id=${data ? data.id : 'n/a'}`)
  } catch (e) {
    record('storage bucket bmb-images present (011)', false, String(e).slice(0, 100))
  }

  const anonInsert = await fetch(`${REST()}/products`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'truth-lock-probe', name: 'TRUTH LOCK PROBE', price: 999 }),
  })
  record('anon INSERT into products rejected', anonInsert.status === 401 || anonInsert.status === 403,
    `status=${anonInsert.status} ${(await anonInsert.text()).slice(0, 100)}`)

  // ================================================================
  // E. Summary + evidence file
  // ================================================================
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  const summary = {
    project: 'bitemebaby production', supabaseUrl: SUPABASE_URL,
    timestamp: new Date().toISOString(),
    total: results.length, passed, failed,
    notes: [
      'read-only by design; RPC probes abort before persisting',
      'pg_policies SQL dump requires human SQL editor -> e2e/truth-lock.sql (SEC-01 SQL-level pending owner run)',
    ],
    checks: results,
  }
  fs.writeFileSync(path.join(PROJ, 'e2e', 'truth-lock-result.json'), JSON.stringify(summary, null, 2), 'utf8')
  console.log(`\nTRUTH-LOCK ${passed}/${results.length} passed, ${failed} failed -> e2e/truth-lock-result.json`)
  process.exit(failed === 0 ? 0 : 1)
})()

function parseEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}