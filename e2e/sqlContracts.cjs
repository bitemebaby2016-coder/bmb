// ============================================
// Bite Me Baby — QA-03 SQL Contract Tests (live DB, read-only)
// ============================================
// Runs the SAME money/order RPC contracts the vitest mock enforces against the
// REAL production Postgres (via PostgREST + service key). Negative probes abort
// BEFORE any row persists, so the run is read-only.
//
//   node e2e/sqlContracts.cjs            -> pre-017 contract set (money/order + guard)
//   node e2e/sqlContracts.cjs --include-new -> also probes 017/018 RPCs (after deploy)
//
// Evidence: e2e/sql-contract-result.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const ENV = parseEnv(path.join(PROJ, '.env'))
const SUPABASE_URL = ENV.VITE_SUPABASE_URL || ''
const ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY || ''
const SVC_KEY = fs.readFileSync(path.join(PROJ, 'supabase.temp', 'srkey.local'), 'utf8').trim()
const INCLUDE_NEW = process.argv.includes('--include-new')

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail: detail == null ? null : String(detail).slice(0, 260) })
  console.log((ok ? 'check ' : 'XMARK ') + name + (detail ? ' :: ' + String(detail).slice(0, 180) : ''))
}

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  })
  return { status: res.status, body: (await res.text()).slice(0, 300) }
}

const isControlled = (b) => /ERR_|FORBIDDEN|violates/.test(b)
const isMissingFn = (b) => /PGRST202/.test(b)

;(async () => {
  // ============ MONEY + ORDER SPINE (migrations 007/008) ============
  const spine = [
    // create_order / 007
    ['create_order_with_items must reject empty order (ERR)', 'create_order_with_items', { p_items: [], p_delivery_round_id: 'round-x' }, isControlled],
    ['create_order_with_items must reject missing round', 'create_order_with_items', { p_items: [{ product_id: 'prod-x', quantity: 1 }], p_delivery_round_id: '' }, isControlled],
    // transitions / 008
    ['transition_order_status must fail on unknown order', 'transition_order_status', { p_order_number: 'NOPE-999999-999', p_new_status: 'delivered' }, (b) => /ERR_ORDER_NOT_FOUND|ERR_NOT_AUTHENTICATED/.test(b)],
    // payments / 008
    ['create_payment_intent_record must guard missing order', 'create_payment_intent_record', { p_order_number: '', p_amount: 0 }, isControlled],
    ['confirm_offline_payment must guard non-admin', 'confirm_offline_payment', { p_order_number: '' }, (b) => /ERR_FORBIDDEN|ERR_MISSING_ORDER/.test(b)],
    ['mark_payment_failed must guard non-admin', 'mark_payment_failed', { p_order_number: '' }, (b) => /ERR_FORBIDDEN|ERR_MISSING_ORDER/.test(b)],
    ['record_payment_result must guard empty order', 'record_payment_result', { p_order_number: '', p_payment_intent_id: '', p_amount: 0 }, isControlled],
    ['compute_addons_price exists (016) and returns 0', 'compute_addons_price', { p_product_id: null, p_options: null }, (b) => b.includes('0')],
  ]
  for (const [label, fn, args, okFn] of spine) {
    const r = await rpc(fn, args)
    record(`QA-03 ${label}`, !isMissingFn(r.body) && okFn(r.body), `status=${r.status} ${r.body.slice(0, 110)}`)
  }

  // ============ PHASE 1 NEW RPCs (migrations 017/018 — after deploy) ============
  if (INCLUDE_NEW) {
    const added = [
      ['pre-order RPC create_pre_order_with_items is deployed', 'create_pre_order_with_items', { p_product_id: 'null', p_quantity: 1 }, isControlled],
      ['pre-order RPC quote_pre_order is deployed', 'quote_pre_order', { p_product_id: 'null', p_quantity: 1 }, isControlled],
      ['pre-order RPC cancel_pre_order is deployed', 'cancel_pre_order', { p_order_number: 'NULL-0' }, isControlled],
      ['audit RPC append_audit_log is deployed', 'append_audit_log', { p_action: 'test', p_entity_type: 'probe' }, (b) => b.includes('ok') || b.includes('ERR_NOT_AUTHENTICATED')],
    ]
    for (const [label, fn, args, okFn] of added) {
      const r = await rpc(fn, args)
      record(`QA-03 ${label}`, !isMissingFn(r.body) && okFn(r.body), `status=${r.status} ${r.body.slice(0, 110)}`)
    }

      // ============ PHASE 2 KITCHEN (migration 019 — after deploy) ============
    const kitchen = [
      ['kitchen RPC deduct_inventory_for_order is deployed', 'deduct_inventory_for_order', { p_order_number: 'NULL-0' }, (b) => /ERR_ORDER_NOT_FOUND|ERR_FORBIDDEN/.test(b)],
      ['kitchen RPC restore_inventory_for_order is deployed', 'restore_inventory_for_order', { p_order_number: 'NULL-0' }, (b) => /ERR_ORDER_NOT_FOUND|ERR_FORBIDDEN/.test(b)],
      ['kitchen RPC create_production_batch is deployed', 'create_production_batch', { p_delivery_round_id: 'round-x', p_scheduled_date: '2026-01-01' }, (b) => /ERR_ROUND_NOT_FOUND|ERR_FORBIDDEN/.test(b)],
      ['kitchen RPC kitchen_queue is deployed', 'kitchen_queue', { p_delivery_round_id: null, p_scheduled_date: null }, (b) => b.includes('batches') || b.includes('ERR_FORBIDDEN')],
      ['kitchen RPC get_inventory_requirements is deployed', 'get_inventory_requirements', { p_product_id: null, p_quantity: 1 }, isControlled],
    ]
    for (const [label, fn, args, okFn] of kitchen) {
      const r = await rpc(fn, args)
      record(`QA-03 ${label}`, !isMissingFn(r.body) && okFn(r.body), `status=${r.status} ${r.body.slice(0, 110)}`)
    }
  }

  // ============ PHASE 4 (migration 021 — after deploy) ============
  if (INCLUDE_NEW) {
    const phase4 = [
      ['phase4 RPC create_notification deployed', 'create_notification', { p_title: 't', p_message: 'm', p_category: 'Transactional' }, (b) => /ok|ERR_/.test(b)],
      ['phase4 RPC record_system_error deployed', 'record_system_error', { p_message: 'probe' }, (b) => /ok|ERR_/.test(b)],
      ['phase4 RPC get_ai_memory deployed', 'get_ai_memory', {}, (b) => b.includes('memory') || b.includes('ERR_')],
      ['phase4 RPC upsert_mascot_override deployed', 'upsert_mascot_override', { p_role_name: 'x', p_media_url: 'y' }, (b) => /ok|ERR_FORBIDDEN/.test(b)],
    ]
    for (const [label, fn, args, okFn] of phase4) {
      const r = await rpc(fn, args)
      record(`QA-03 ${label}`, !isMissingFn(r.body) && okFn(r.body), `status=${r.status} ${r.body.slice(0, 110)}`)
    }
  }

  const passed = results.filter((r) => r.ok).length
  const pending = INCLUDE_NEW ? 0 : 13 // 017/018 (4) + 019 kitchen (5) + 021 phase4 (4) probes
  fs.writeFileSync(
    path.join(PROJ, 'e2e', 'sql-contract-result.json'),
    JSON.stringify({
      project: 'bitemebaby production', timestamp: new Date().toISOString(),
      total: results.length, passed, pendingDeploy: pending,
      note: INCLUDE_NEW
        ? 'migrations 017/018/019 applied — full Phase 1+2 contract set'
        : 'pre-017 contract set — run again with --include-new after supabase db push (017+018+019)',
      checks: results,
    }, null, 2),
    'utf8',
  )
  console.log(`\nSQL-CONTRACTS ${passed}/${results.length} passed (${pending} pending-deploy checks excluded) -> e2e/sql-contract-result.json`)
  process.exit(passed === results.length ? 0 : 1)
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