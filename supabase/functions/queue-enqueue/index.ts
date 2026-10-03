// ============================================
// Bite Me Baby — Edge Function: queue-enqueue (G8-T2, Owner decision D06 = OPTION A)
//
// SINGLE RESPONSIBILITY — transport/security boundary ONLY:
//   authenticate caller → validate request schema → construct ONLY allowed
//   enqueue contract → call enqueue_automation_job() (DB = authority) →
//   return deterministic result. NO business semantics.
//
// HARD BOUNDARIES (G8-T2):
//   - NO business authority: never computes price/fee, never mutates
//     orders/payments/inventory/kitchen/delivery, never cancels/refunds
//   - NO arbitrary RPC/table/proxy — calls exactly ONE RPC
//   - NO application-level check-then-insert idempotency — DB RPC owns
//     idempotency (ON CONFLICT DO NOTHING); only the canonical result is propagated
//   - NO tenant/brand/business authority fields accepted — non-allowlisted
//     caller params are IGNORED (not forwarded)
//   - service_role stays server-side (Deno.env) — never logged/returned
//
// Authentication (same pattern as automation-worker, verified in production):
//   - verify_jwt = true (platform layer)
//   - shared-secret header `x-automation-token` must equal AUTOMATION_TOKEN
//     Supabase secret. Credential: GitHub repo secret `AUTOMATION_TOKEN`
//     (existing — NO new secret required) → transmitted as request header.
//     Rotation: DR runbook §C (regenerate → supabase secrets set → update GH secret).
//
// Request contract:
//   POST { job: 'notification_dispatch'|'orders_stale_pending'|'inventory_low_stock'
//               |'synthetic_selftest'
//          ref:  string /^[a-z0-9][a-z0-9-]{3,63}$/   (idempotency identity suffix)
//          params?: object (allowlisted fields only — everything else ignored) }
//   → id = 'sched-' + job + '-' + ref  (deterministic; DB PK enforces uniqueness)
//   → payload = template constructed server-side (caller cannot inject extra fields)
//   → max_attempts = 3, available_at = now()  (fixed server-side)
//
// Response contract (deterministic):
//   401 {error:'unauthorized'} — bad/missing token · 400 invalid json/ref/unknown job/invalid_params
//   502 {error:'rpc_failed'} · 200 {ok:true,result:'ENQUEUED'} · 200 DUPLICATE (no-op) · 400 INVALID
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''

// Allowlist — legacy jobs use the EXACT payload templates from
// automation-scheduler.yml (S3 audit §2). No invented contracts.
// synthetic_selftest = already-approved synthetic job (G8-S2/S4 evidence).
const ALLOWED: Record<string, { worker: string; build: (p: Record<string, unknown>) => Record<string, unknown> | string }> = {
  notification_dispatch: {
    worker: 'automation-worker',
    build: (p) => {
      const lookback = Number(p.lookbackMinutes)
      const limit = Number(p.limit)
      if (!Number.isInteger(lookback) || lookback < 1 || lookback > 1440) return 'lookbackMinutes must be integer 1..1440'
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) return 'limit must be integer 1..500'
      return { lookbackMinutes: lookback, limit }
    },
  },
  orders_stale_pending: {
    worker: 'automation-worker',
    build: (p) => {
      const maxAge = Number(p.maxAgeMinutes)
      if (!Number.isInteger(maxAge) || maxAge < 1 || maxAge > 10080) return 'maxAgeMinutes must be integer 1..10080'
      // customerNamePrefix is TEST DATA ONLY — deliberately NOT accepted in scheduler path (S3 §4)
      return { maxAgeMinutes: maxAge }
    },
  },
  inventory_low_stock: {
    worker: 'automation-worker',
    build: (p) => {
      const th = Number(p.stockThreshold)
      if (!Number.isInteger(th) || th < 0 || th > 100) return 'stockThreshold must be integer 0..100'
      return { stockThreshold: th }
    },
  },
  synthetic_selftest: {
    worker: 'synthetic-evidence',
    build: () => ({ synthetic: true }), // fixed shape — nothing caller-controllable
  },
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-token',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // --- authentication: shared automation token (same pattern as automation-worker) ---
  const hdr = req.headers.get('x-automation-token') || ''
  if (!TOKEN) return json({ error: 'transport not configured (AUTOMATION_TOKEN missing)' }, 500)
  if (!hdr || hdr !== TOKEN) return json({ error: 'unauthorized' }, 401)
  if (!SERVICE) return json({ error: 'service not configured' }, 500)

  let payload: { job?: string; ref?: string; params?: Record<string, unknown> }
  try { payload = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  const job = typeof payload.job === 'string' ? payload.job : ''
  const spec = ALLOWED[job]
  if (!spec) return json({ error: 'unknown job' }, 400)

  const ref = typeof payload.ref === 'string' ? payload.ref : ''
  if (!/^[a-z0-9][a-z0-9-]{3,63}$/.test(ref)) return json({ error: 'invalid_ref' }, 400)

  const params = (payload.params && typeof payload.params === 'object') ? payload.params : {}
  const built = spec.build(params)
  if (typeof built === 'string') return json({ error: 'invalid_params', detail: built }, 400)

  // --- DB enqueue boundary is the AUTHORITY — single RPC call, no check-then-act ---
  const id = 'sched-' + job + '-' + ref
  const r = await fetch(SB_URL + '/rest/v1/rpc/enqueue_automation_job', {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_id: id,
      p_job_type: job,
      p_worker: spec.worker,
      p_payload: built,
      p_max_attempts: 3,
    }),
  })
  if (r.status !== 200) return json({ error: 'rpc_failed', status: r.status }, 502)
  const result = await r.text().then((t) => t.replace(/"/g, ''))

  if (result === 'ENQUEUED') return json({ ok: true, result: 'ENQUEUED', id })
  if (result === 'DUPLICATE') return json({ ok: true, result: 'DUPLICATE', duplicate: true, id })
  return json({ error: result || 'INVALID' }, 400)
})