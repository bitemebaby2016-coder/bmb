// ============================================
// Bite Me Baby — Edge Function: queue-dispatcher (G8-S5, Owner-authorized cutover)
//
// SINGLE RESPONSIBILITY — queue → canonical worker bridge ONLY:
//   authenticate → claim queued job(s) of ONE job_type (atomic FOR UPDATE SKIP LOCKED)
//   → invoke the CANONICAL worker (automation-worker) UNCHANGED with
//     eventId = queue id → map worker outcome to queue terminal state via
//     complete/fail RPC → return deterministic report.
//
// HARD BOUNDARIES:
//   - NO business logic: worker payload comes from the queue row verbatim;
//     dispatcher NEVER constructs/extends business payloads (OD-1: canonical
//     worker remains the only business authority)
//   - job_type allowlist = exactly the 3 legacy scheduler jobs (no synthetic here)
//   - complete on worker 'succeeded' | 'partial' | duplicate response
//     (partial/duplicate = terminal for this identity — no reinterpretation)
//   - fail mapping: 401/403 → 'auth' (dead, non-retryable) · 400 →
//     'malformed_input' (dead) · worker 'failed' → 'worker_failure' (retryable
//     backoff) · HTTP 5xx/network → 'db_transient' (retryable backoff)
//   - idempotency: eventId = queue id (deterministic) → worker audit trace
//     auto-exec-<queue id>; a re-execution of the same identity returns the
//     worker's duplicate response → complete, never a second canonical execution
//   - service_role stays server-side; token never logged/echoed
//
// Authentication: identical to automation-worker / queue-enqueue
//   (verify_jwt = true + x-automation-token == AUTOMATION_TOKEN).
//
// Request:  POST { jobType: 'notification_dispatch'|'orders_stale_pending'|'inventory_low_stock' }
// Response: 200 { claimed:0, results:[] } · 200 { claimed:n, results:[{id,
//           workerStatus, workerHttp, queueResult, finalStatus, attempts}] }
//           · 401/400/502 errors
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''
const WORKER_URL = SB_URL + '/functions/v1/automation-worker'
// publishable key = public platform key (same one the scheduler workflow uses)
const ANON = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'

const JOB_TYPES = ['notification_dispatch', 'orders_stale_pending', 'inventory_low_stock']

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

async function rpc(fn: string, body: unknown): Promise<{ status: number; text: string }> {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  return { status: r.status, text: await r.text() }

interface QueueRow {
  id: string
  job_type: string
  payload: Record<string, unknown>
  attempt_count: number
}

}

async function runOne(row: QueueRow): Promise<Record<string, unknown>> {
  let workerHttp = 0
  let workerStatus: string = 'unreachable'
  let retryable = true
  let reason = 'db_transient'
  try {
    const wr = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, 'x-automation-token': TOKEN },
      body: JSON.stringify({ job: row.job_type, eventId: row.id, ...row.payload }),
      signal: AbortSignal.timeout(180000),
    })
    workerHttp = wr.status
    let wj: any = null
    try { wj = JSON.parse(await wr.text()) } catch { /* non-json */ }
    workerStatus = (wj && (wj.status || (wj.duplicate === true ? 'duplicate' : null))) || 'invalid_response'
    if (wr.status === 200) {
      if (wj && (wj.status === 'succeeded' || wj.status === 'partial' || wj.duplicate === true)) {
        retryable = false // terminal for this identity — complete below
      } else {
        reason = 'worker_failure'
      }
    } else if (wr.status === 401 || wr.status === 403) {
      retryable = false; reason = 'auth'
    } else if (wr.status === 400) {
      retryable = false; reason = 'malformed_input'
    }
  } catch (e) {
    workerStatus = 'unreachable: ' + String(e && e instanceof Error ? e.message : e).slice(0, 100)
    reason = 'db_transient'
  }

  let queueResult = 'SKIPPED'
  if (retryable === false && workerHttp === 200) {
    const c = await rpc('complete_automation_job', { p_id: row.id })
    queueResult = c.text.replace(/"/g, '')
  } else {
    const f = await rpc('fail_automation_job', {
      p_id: row.id,
      p_error: ('worker_http=' + workerHttp + ' status=' + workerStatus).slice(0, 2000),
      p_reason: reason,
      p_retryable: retryable,
    })
    queueResult = f.text.replace(/"/g, '')
  }
  const st = await fetch(SB_URL + '/rest/v1/automation_queue?select=status,attempt_count&id=eq.' + encodeURIComponent(row.id), {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
  })
  const sj = await st.json().catch(() => [])
  return {
    id: row.id,
    workerHttp,
    workerStatus,
    queueResult,
    finalStatus: sj?.[0]?.status || 'unknown',
    attempts: sj?.[0]?.attempt_count ?? row.attempt_count,
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const hdr = req.headers.get('x-automation-token') || ''
  if (!TOKEN) return json({ error: 'transport not configured (AUTOMATION_TOKEN missing)' }, 500)
  if (!hdr || hdr !== TOKEN) return json({ error: 'unauthorized' }, 401)
  if (!SERVICE) return json({ error: 'service not configured' }, 500)

  let payload: { jobType?: string }
  try { payload = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
  const jobType = typeof payload.jobType === 'string' ? payload.jobType : ''
  if (!JOB_TYPES.includes(jobType)) return json({ error: 'unknown jobType' }, 400)

  // atomic claim: FOR UPDATE SKIP LOCKED inside the RPC — concurrent dispatchers
  // never get the same row; batch=10 drains leftovers from missed dispatch calls
  const claim = await rpc('claim_automation_jobs', {
    p_job_type: jobType, p_worker: 'automation-worker', p_batch: 10, p_lease_minutes: 5,
  })
  if (claim.status !== 200) return json({ error: 'claim_failed', status: claim.status }, 502)
  let rows: QueueRow[] = []
  try { rows = JSON.parse(claim.text) } catch { return json({ error: 'claim_parse_failed' }, 502) }
  if (!Array.isArray(rows) || rows.length === 0) return json({ claimed: 0, results: [] })

  const results: Record<string, unknown>[] = []
  for (const row of rows) {
    results.push(await runOne(row))
  }
  return json({ claimed: rows.length, results })
})
