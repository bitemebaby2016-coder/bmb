// ============================================
// R0 production read-only audit (2026-10-23) — Recovery Plan R0
// Management API /database/query — SELECT-only probes, zero writes.
// Token read from .env.local (SUPABASE_ACCESS_TOKEN) — NEVER printed.
// Output: e2e/artifacts/r0-prod-audit.json (ASCII-safe JSON)
// ============================================
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1]?.trim()
if (!token) { console.error('ERR: SUPABASE_ACCESS_TOKEN missing'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'
const URL = `https://api.supabase.com/v1/projects/${REF}/database/query`

const QUERIES = {
  // --- D-01: which migration objects actually exist in production ---
  objects_135_136_137: `SELECT to_regclass('public.driver_location_history') AS loc_hist, to_regclass('public.dispatch_offers') AS offers, to_regclass('public.dispatch_offer_declines') AS declines, to_regclass('public.marketing_posts') AS mposts, to_regclass('public.marketing_rules') AS mrules, to_regclass('public.order_submissions') AS subs, to_regclass('public.payment_intents') AS intents, to_regclass('public.delivery_assignments') AS asg`,
  functions_present: `SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('driver_update_location','claim_dispatch_offer','dispatch_order','driver_decline_offer','cancel_dispatch_offer','marketing_schedule_post','marketing_save_rules','assign_driver','confirm_offline_payment','submit_payment_slip','admin_advance_delivery_status','create_order_with_items_i','my_deliveries','admin_list_jobs') ORDER BY 1`,
  migrations_recorded: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 12`,

  // --- H-02 / D-04: payment intent gaps ---
  orders_without_intent: `SELECT o.order_number, o.status, o.payment_status, o.payment_method, o.created_at FROM public.orders o WHERE NOT EXISTS (SELECT 1 FROM public.payment_intents pi WHERE pi.order_number = o.order_number) ORDER BY o.created_at DESC LIMIT 20`,
  orders_without_intent_count: `SELECT count(*) AS n FROM public.orders o WHERE NOT EXISTS (SELECT 1 FROM public.payment_intents pi WHERE pi.order_number = o.order_number)`,
  intent_distribution: `SELECT method, status, count(*) AS n FROM public.payment_intents GROUP BY 1, 2 ORDER BY 1, 2`,
  pending_pay_with_evidence: `SELECT o.order_number, o.payment_method, o.payment_status, pi.status AS intent_status, (pi.slip_path IS NOT NULL) AS has_slip, (pi.metadata ? 'reference') AS has_txnref, o.created_at FROM public.orders o LEFT JOIN public.payment_intents pi ON pi.order_number = o.order_number WHERE o.payment_status = 'pending' ORDER BY o.created_at DESC LIMIT 20`,

  // --- H-03 / D-07: branch values ---
  branches: `SELECT id, name, is_default, status FROM public.branches ORDER BY is_default DESC LIMIT 10`,
  home_branch_fn: `SELECT public.resolve_home_branch_id() AS home_branch`,
  rounds_branch: `SELECT id, branch_id, round_date, status FROM public.delivery_rounds ORDER BY round_date DESC LIMIT 8`,
  orders_branch_null: `SELECT count(*) FILTER (WHERE branch_id IS NULL) AS null_branch, count(*) AS total FROM public.orders`,
  // --- order state / D-03 / D-06 ---
  order_status_matrix: `SELECT status, payment_status, count(*) AS n FROM public.orders GROUP BY 1, 2 ORDER BY 3 DESC`,
  recent_orders: `SELECT order_number, status, payment_status, payment_method, order_mode, branch_id, created_at FROM public.orders ORDER BY created_at DESC LIMIT 12`,
  d03_queue_counts: `SELECT count(*) FILTER (WHERE status = 'ready_for_dispatch') AS ready_only, count(*) FILTER (WHERE status IN ('confirmed','preparing','ready_for_dispatch')) AS rpc_allowed FROM public.orders`,
  submissions_recent: `SELECT order_number, created_at FROM public.order_submissions ORDER BY created_at DESC LIMIT 8`,
  submissions_count: `SELECT count(*) AS n FROM public.order_submissions`,

  // --- rider chain / H-04 ---
  drivers_linked: `SELECT id, driver_name, status, home_branch_id, (user_id IS NOT NULL) AS linked, last_seen_at FROM public.drivers ORDER BY last_seen_at DESC NULLS LAST LIMIT 10`,
  assignments_matrix: `SELECT status, count(*) AS n FROM public.delivery_assignments GROUP BY 1 ORDER BY 2 DESC`,
  offers_matrix: `SELECT status, count(*) AS n FROM public.dispatch_offers GROUP BY 1`,
  offers_open: `SELECT order_number, status, claimed_by_driver_id, created_at FROM public.dispatch_offers ORDER BY created_at DESC LIMIT 10`,

  // --- marketing 137 / store settings D-02 ---
  marketing_counts: `SELECT (SELECT count(*) FROM public.marketing_posts) AS posts, (SELECT count(*) FROM public.marketing_rules) AS rules`,
  settings_keys: `SELECT key FROM public.business_settings ORDER BY key`,
}

const out = { generated_at: new Date().toISOString(), ref: REF, queries: {} }
for (const [name, query] of Object.entries(QUERIES)) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 500) } }
    out.queries[name] = { status: res.status, rows: body }
    console.log(`${name}: HTTP ${res.status}`)
  } catch (e) {
    out.queries[name] = { error: String(e) }
    console.log(`${name}: ERROR`)
  }
}

// --- read-only: EF status + secrets names (GET only) ---
for (const [name, url] of Object.entries({
  functions: `https://api.supabase.com/v1/projects/${REF}/functions`,
  secrets: `https://api.supabase.com/v1/projects/${REF}/secrets`,
})) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json()
    if (name === 'functions') {
      out[name] = (Array.isArray(body) ? body : body?.data ?? []).map((f) => ({ name: f.name, status: f.status, version: f.version }))
    } else {
      out[name] = (Array.isArray(body) ? body : body?.data ?? []).map((s) => s.name)
    }
    console.log(`${name}: HTTP ${res.status}`)
  } catch (e) {
    out[name] = { error: String(e) }
    console.log(`${name}: ERROR`)
  }
}

writeFileSync(join(root, 'e2e/artifacts/r0-prod-audit.json'), JSON.stringify(out, null, 2))
console.log('WROTE e2e/artifacts/r0-prod-audit.json')
