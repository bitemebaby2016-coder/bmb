// ============================================
// push115Probe — read-only runtime verification for migration 115 (Web Push)
//   node e2e/push115Probe.cjs
//
// READ-ONLY ONLY. Never inserts a fake order / never fabricates a delivery.
// Checks the schema + RPC + config surface that the client and push-send
// actually call, using the anon key (i.e. proves the RLS surface, not the
// service-role bypass).
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const SB = env.VITE_SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const ANON = env.VITE_SUPABASE_ANON_KEY || ''
const SERVICE = (() => {
  const raw = fs.readFileSync(path.join(ROOT, 'supabase', 'secrets.local.env'), 'utf8')
  const m = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)
  return m ? m[1].trim() : ''
})()

let pass = 0
let fail = 0

function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

async function rpcAs(key, fn, args = {}) {
  const res = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: res.status, json, text }
}

async function restAs(key, path) {
  const res = await fetch(SB + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: res.status, json }
}

async function main() {
  console.log('--- push115 read-only probe ---')

  // 1) get_push_config is publicly readable and returns the admin-managed shape
  const cfg = await rpcAs(ANON, 'get_push_config')
  check('get_push_config callable by anon', cfg.status === 200, `HTTP ${cfg.status}`)
  if (cfg.status === 200 && cfg.json) {
    check('config has enabled flag', typeof cfg.json.enabled === 'boolean', `enabled=${cfg.json.enabled}`)
    check('config exposes vapid_public_key field', 'vapid_public_key' in cfg.json)
    check('config NEVER exposes a private key',
      !JSON.stringify(cfg.json).toLowerCase().includes('private'),
      Object.keys(cfg.json).join(','))
    // The stored key must be the bare 87-char unpadded base64url body: web-push
    // validates it with /^[A-Za-z0-9\-_]+$/ and rejects '=' or a leading 'B'.
    const pk = cfg.json.vapid_public_key || ''
    check('vapid_public_key is unpadded base64url of the 65-byte point',
      pk.length === 87 && /^[A-Za-z0-9\-_]+$/.test(pk) && !pk.includes('='),
      `len=${pk.length} matches=/^[A-Za-z0-9\\-_]+$/`)
    check('vapid_public_key decodes to 65 bytes',
      Buffer.from(pk.replace(/-/g, '+').replace(/_/g, '/'), 'base64').length === 65,
      'uncompressed point = 0x04 || X || Y')
  }

  // 2) customer-facing RPCs must REFUSE an anonymous caller
  for (const fn of ['register_push_subscription', 'unregister_push_subscription', 'set_push_transport_pref', 'list_my_push_subscriptions']) {
    const r = await rpcAs(ANON, fn, fn === 'register_push_subscription'
      ? { p_endpoint: 'https://probe.invalid/x', p_p256dh: 'k', p_auth_secret: 'a' }
      : fn === 'set_push_transport_pref' ? { p_enabled: true } : {})
    const refused = r.status >= 400
    check(`${fn} refuses anon`, refused, `HTTP ${r.status}`)
  }

  // 3) service_role-only RPCs must be CLOSED to anon
  for (const [fn, args] of [['claim_push_targets', { p_customer_id: 'probe-nonexistent' }], ['mark_push_result', { p_subscription_id: 'probe-nonexistent', p_success: true }]]) {
    const r = await rpcAs(ANON, fn, args)
    check(`${fn} closed to anon`, r.status >= 400, `HTTP ${r.status}`)
  }

  // 4) the table exists with RLS enabled and is invisible to anon
  const anonRead = await restAs(ANON, '/rest/v1/push_subscriptions?select=id&limit=1')
  check('push_subscriptions denies anon select', anonRead.status >= 400, `HTTP ${anonRead.status}`)

  const svcRead = await restAs(SERVICE, '/rest/v1/push_subscriptions?select=id&limit=1')
  check('push_subscriptions readable by service_role', svcRead.status === 200, `HTTP ${svcRead.status}`)

  // 5) transport flags landed on notification_prefs
  const prefsCols = await restAs(SERVICE, '/rest/v1/notification_prefs?select=push_enabled,sms_enabled&limit=1')
  check('notification_prefs exposes push_enabled + sms_enabled', prefsCols.status === 200, `HTTP ${prefsCols.status}`)

  // 6) claim_push_targets works for service_role and returns [] for an unknown customer
  const claim = await rpcAs(SERVICE, 'claim_push_targets', { p_customer_id: 'probe-nonexistent-customer', p_limit: 5 })
  check('claim_push_targets works for service_role', claim.status === 200, `HTTP ${claim.status}`)
  if (claim.status === 200 && claim.json) {
    check('claim returns empty target list for unknown customer',
      Array.isArray(claim.json.targets) && claim.json.targets.length === 0,
      `targets=${JSON.stringify(claim.json.targets)}`)
  }

  console.log(`--- PUSH115_RESULT: ${pass} pass / ${fail} fail ---`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('PUSH115_PROBE_ERROR: ' + e.message); process.exit(1) })