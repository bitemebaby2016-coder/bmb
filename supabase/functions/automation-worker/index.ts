// ============================================
// Bite Me Baby — Edge Function: automation-worker (W3-B Native Automation)
//
// Native BMB back-office worker. NO Make.com, NO external automation engine.
// Supabase PostgreSQL remains the canonical source of truth: this worker only
// READS canonical business state and performs APPROVED back-office actions
// (record notifications / audit trace). It NEVER changes authoritative
// business state (price/promotion/coupon/inventory/capacity/payment/refund/
// delivery fee/order state/settlement) — those stay behind Supabase RPC/RLS.
//
// Authority model:
//   EVENT → VALIDATE → LOAD CANONICAL DATA → EXECUTE ACTION → RECORD RESULT
//   → (caller-driven retry; never automatic infinite retry)
//
// Durable state WITHOUT new schema:
//   - execution trace  = public.audit_logs   (action='automation.execution',
//     id='auto-exec-<event_id>', metadata: event_id/execution_id/status/…)
//   - side effects     = public.notifications (deterministic ids, dedupe)
//
// Idempotency (durable, DB-based — NOT in-memory):
//   ONE LOGICAL EVENT (event_id) → ONE LOGICAL SIDE EFFECT.
//   If audit_logs already holds a SUCCEEDED execution for the event_id, the
//   worker returns { duplicate: true } and does nothing.
//
// Security:
//   - verify_jwt = true (platform rejects anonymous callers)
//   - shared-secret header `x-automation-token` must equal the
//     AUTOMATION_TOKEN Supabase secret (rotated by Owner)
//   - service_role key stays server-side (Deno.env), never logged/returned
//
// Jobs:
//   orders_stale_pending  — orders stuck in pending longer than maxAgeMinutes
//                           (optional customerNamePrefix: TEST DATA ONLY)
//   inventory_low_stock   — products.stock below threshold (display value;
//                           notification only — no authority change)
//
// Called by: Supabase Cron (pg_cron) / owner-triggered HTTP with the token.
// ============================================

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

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''

/** Deterministic event window: one logical event per job per hour bucket. */
function defaultEventId(job: string): string {
  const now = new Date()
  const bucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()))
  return `${job}:${bucket.toISOString()}`
}

async function rest(key: string, method: string, path: string, body?: unknown, prefer?: string): Promise<{ status: number; j: any }> {
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  }
  if (prefer) headers['Prefer'] = prefer
  const r = await fetch(SB_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let j: any = null
  try { j = JSON.parse(text) } catch { /* empty */ }
  return { status: r.status, j }
}

interface Ctx {
  eventId: string
  executionId: string
  job: string
  results: Record<string, unknown>
  errors: string[]
}

/** Fetch the previous execution record for this event_id (durable idempotency). */
async function previousExecution(eventId: string): Promise<{ status?: string; execution_id?: string } | null> {
  const q = await rest(
    SERVICE,
    'GET',
    `/rest/v1/audit_logs?action=eq.automation.execution&id=eq.auto-exec-${encodeURIComponent(eventId)}&select=metadata&limit=1`,
  )
  const m = q.j?.[0]?.metadata
  return m || null
}

/** Record (insert-or-update) the execution trace. Idempotent by PK. */
async function recordExecution(ctx: Ctx, status: 'succeeded' | 'failed' | 'partial'): Promise<void> {
  const row = {
    id: 'auto-exec-' + ctx.eventId,
    action: 'automation.execution',
    entity_type: 'automation',
    entity_id: ctx.job,
    description: `automation ${ctx.job} ${status}`,
    metadata: {
      job: ctx.job,
      event_id: ctx.eventId,
      execution_id: ctx.executionId,
      status,
      results: ctx.results,
      errors: ctx.errors,
      finished_at: new Date().toISOString(),
    },
  }
  await rest(SERVICE, 'POST', '/rest/v1/audit_logs', row, 'resolution=merge-duplicates')
}

/** Insert a notification with a deterministic id — ONE logical side effect. */
async function notifyOnce(id: string, title: string, message: string, type: string): Promise<'created' | 'duplicate'> {
  const ex = await rest(SERVICE, 'GET', `/rest/v1/notifications?id=eq.${encodeURIComponent(id)}&select=id&limit=1`)
  if (ex.status === 200 && Array.isArray(ex.j) && ex.j.length > 0) return 'duplicate'
  const ins = await rest(
    SERVICE,
    'POST',
    '/rest/v1/notifications',
    { id, title, message, notification_type: type, is_read: false },
    'resolution=ignore-duplicates',
  )
  return ins.status === 201 ? 'created' : 'duplicate'
}

async function runOrdersStalePending(ctx: Ctx, p: { maxAgeMinutes?: number; customerNamePrefix?: string }): Promise<void> {
  const maxAge = Math.max(1, Math.min(60 * 24 * 7, p.maxAgeMinutes ?? 120))
  const cutoff = new Date(Date.now() - maxAge * 60_000).toISOString()
  let path = `/rest/v1/orders?select=order_number,customer_name,created_at&status=eq.pending&created_at=lt.${encodeURIComponent(cutoff)}&limit=100`
  if (p.customerNamePrefix) path += `&customer_name=like.${encodeURIComponent(p.customerNamePrefix + '*')}`
  const q = await rest(SERVICE, 'GET', path)
  if (q.status !== 200) throw new Error('orders read failed: ' + q.status)
  const orders: Array<{ order_number: string; customer_name: string }> = q.j || []
  const created: string[] = []
  const dup: string[] = []
  for (const o of orders) {
    const r = await notifyOnce(
      'auto-stale-' + o.order_number,
      'ออเดอร์ค้าง pending',
      `ออเดอร์ ${o.order_number} (ลูกค้า: ${o.customer_name || '-'}) ยัง pending นานเกิน ${maxAge} นาที — ตรวจสอบที่ห้องครัว/แอดมิน`,
      'automation',
    )
    ;(r === 'created' ? created : dup).push(o.order_number)
  }
  ctx.results.orders_stale_pending = { found: orders.length, notified: created, already_notified: dup }
}

async function runInventoryLowStock(ctx: Ctx, p: { stockThreshold?: number }): Promise<void> {
  const th = Math.max(0, Math.min(999, p.stockThreshold ?? 3))
  const q = await rest(SERVICE, 'GET', `/rest/v1/products?select=id,name,stock&stock=not.is.null&stock=lt.${th}&limit=100`)
  if (q.status !== 200) throw new Error('products read failed: ' + q.status)
  const items: Array<{ id: string; name: string; stock: number }> = q.j || []
  const created: string[] = []
  const dup: string[] = []
  for (const it of items) {
    const r = await notifyOnce(
      'auto-stock-' + it.id,
      'สต๊อกใกล้หมด',
      `${it.name} เหลือ stock ${it.stock} ชิ้น (ต่ำกว่า ${th}) — แจ้งเพื่อเตรียมสต๊อก (ค่าแสดงผล ไม่ใช่ capacity authority)`,
      'automation',
    )
    ;(r === 'created' ? created : dup).push(it.id)
  }
  ctx.results.inventory_low_stock = { threshold: th, found: items.length, notified: created, already_notified: dup }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // --- authentication: platform JWT + shared automation token ---
  const hdr = req.headers.get('x-automation-token') || ''
  if (!TOKEN) return json({ error: 'automation not configured (AUTOMATION_TOKEN missing)' }, 500)
  if (hdr !== TOKEN) return json({ error: 'unauthorized' }, 401)

  let payload: { job?: string; eventId?: string; maxAgeMinutes?: number; customerNamePrefix?: string; stockThreshold?: number }
  try { payload = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  const job = payload.job || ''
  if (!['orders_stale_pending', 'inventory_low_stock'].includes(job)) return json({ error: 'unknown job' }, 400)

  const eventId = payload.eventId || defaultEventId(job)
  const prev = await previousExecution(eventId)
  if (prev && prev.status === 'succeeded') {
    return json({ duplicate: true, event_id: eventId, previous_execution_id: prev.execution_id || null })
  }

  const ctx: Ctx = {
    eventId,
    executionId: crypto.randomUUID(),
    job,
    results: {},
    errors: [],
  }

  try {
    if (job === 'orders_stale_pending') await runOrdersStalePending(ctx, payload)
    else await runInventoryLowStock(ctx, payload)
  } catch (e) {
    ctx.errors.push(String(e && e instanceof Error ? e.message : e))
  }

  const status = ctx.errors.length === 0 ? 'succeeded' : (Object.keys(ctx.results).length ? 'partial' : 'failed')
  await recordExecution(ctx, status as 'succeeded' | 'failed' | 'partial')
  return json({ event_id: eventId, execution_id: ctx.executionId, status, results: ctx.results, errors: ctx.errors })
})

