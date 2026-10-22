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
//   notification_dispatch — W3-D canonical-event notification dispatch:
//                           reads AUTHORITATIVE event feeds (order_status_history
//                           migration 040, delivery_assignments migration 020),
//                           maps approved events → recipient → durable in_app
//                           notification (deterministic id = idempotency key).
//                           NEVER writes orders/payments/inventory.
//
// W3-D event map — ONLY events with an authoritative canonical source:
//   ORDER_*  ← order_status_history.to_status (written inside the order
//              transaction by migration 040 trigger — cannot be forged)
//   DRIVER_* ← delivery_assignments.status (written only by driver RPCs)
//   PAYMENT_SUCCESS/FAILED — NO authoritative event feed exists in the
//              canonical schema (orders.payment_status is current-state only,
//              no payment history table) → deliberately NOT mapped here.
//              OWNER DECISION REQUIRED before inventing a feed (W3-D-3).
//
// Transport abstraction (W3-D-6): in_app = row in public.notifications
// (customer reads it via RLS). All external transports (EMAIL/SMS/PUSH/LINE/
// FACEBOOK/MESSENGER) are declared but NOT CONFIGURED — no credentials exist,
// so the dispatcher never calls them. NOT fake connectivity.
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

// W3-D-7: Web Push transport. Empty string = push not wired on this deployment,
// in which case notification_dispatch behaves exactly as before (no push call).
const PUSH_SEND_URL = Deno.env.get('PUSH_SEND_URL') || (SB_URL ? `${SB_URL}/functions/v1/push-send` : '')

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
async function notifyOnce(
  id: string,
  title: string,
  message: string,
  type: string,
  opts?: { customerId?: string; category?: string },
): Promise<string> {
  const ex = await rest(SERVICE, 'GET', `/rest/v1/notifications?id=eq.${encodeURIComponent(id)}&select=id&limit=1`)
  if (ex.status === 200 && Array.isArray(ex.j) && ex.j.length > 0) return 'duplicate'
  const ins = await rest(
    SERVICE,
    'POST',
    '/rest/v1/notifications',
    { id, title, message, notification_type: type, is_read: false, customer_id: opts?.customerId ?? null, category: opts?.category ?? 'Transactional' },
    'resolution=ignore-duplicates',
  )
  if (ins.status === 201) return 'created'
  // Insert failure must be OBSERVABLE, not silently classified as a duplicate.
  return 'failed:' + ins.status + ':' + JSON.stringify(ins.j).slice(0, 200)
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

// ============================================
// W3-D — notification_dispatch: canonical event → durable in_app notification
// ============================================

/** Approved ORDER_* events — mapped ONLY from order_status_history (migr 040, authoritative). */
const ORDER_EVENT_MAP: Record<string, string> = {
  pending: 'ORDER_CREATED',
  confirmed: 'ORDER_CONFIRMED',
  preparing: 'ORDER_PREPARING',
  ready_for_dispatch: 'ORDER_READY',
  dispatched: 'ORDER_OUT_FOR_DELIVERY',
  delivered: 'ORDER_DELIVERED',
  cancelled: 'ORDER_CANCELLED',
  // in_transit / arrived: no approved notification semantic in the Owner command
  // → deliberately skipped (event exists in feed, notification not approved).
}

/** Approved DRIVER_* events — mapped ONLY from delivery_assignments (migr 020, authoritative). */
const DRIVER_EVENT_MAP: Record<string, string> = {
  assigned: 'DRIVER_ASSIGNED',
  accepted: 'DRIVER_ACCEPTED',
  picked_up: 'DRIVER_PICKED_UP',
  // in_transit / delivered: covered by the ORDER_* feed — same logical fact,
  // a second notification would double-notify (idempotency at fact level).
}

const EVENT_COPY: Record<string, { title: string; body: (d: { orderNumber: string }) => string }> = {
  ORDER_CREATED: { title: 'รับออเดอร์แล้ว', body: (d) => `ออเดอร์ ${d.orderNumber} ของคุณได้รับเรียบร้อยแล้ว` },
  ORDER_CONFIRMED: { title: 'ยืนยันออเดอร์', body: (d) => `ออเดอร์ ${d.orderNumber} ได้รับการยืนยันแล้ว` },
  ORDER_PREPARING: { title: 'กำลังเตรียมอาหาร', body: (d) => `ออเดอร์ ${d.orderNumber} กำลังเตรียมอาหาร` },
  ORDER_READY: { title: 'อาหารพร้อมแล้ว', body: (d) => `ออเดอร์ ${d.orderNumber} พร้อมส่ง/รับแล้ว` },
  ORDER_OUT_FOR_DELIVERY: { title: 'ออกส่งแล้ว', body: (d) => `ออเดอร์ ${d.orderNumber} ออกจัดส่งแล้ว` },
  ORDER_DELIVERED: { title: 'จัดส่งสำเร็จ', body: (d) => `ออเดอร์ ${d.orderNumber} จัดส่งสำเร็จ ขอบคุณที่ใช้บริการ` },
  ORDER_CANCELLED: { title: 'ออเดอร์ถูกยกเลิก', body: (d) => `ออเดอร์ ${d.orderNumber} ถูกยกเลิก` },
  DRIVER_ASSIGNED: { title: 'จัดส่ง: ได้รับไรเดอร์', body: (d) => `ออเดอร์ ${d.orderNumber} ได้รับไรเดอร์แล้ว` },
  DRIVER_ACCEPTED: { title: 'จัดส่ง: ไรเดอร์รับงาน', body: (d) => `ไรเดอร์รับออเดอร์ ${d.orderNumber} แล้ว` },
  DRIVER_PICKED_UP: { title: 'จัดส่ง: รับของแล้ว', body: (d) => `ไรเดอร์รับอาหารสำหรับออเดอร์ ${d.orderNumber} แล้ว` },
}

interface DispatchEvent {
  id: string
  orderNumber: string
  eventType: string
}

/** W3-D dispatcher: canonical events → recipient → durable in_app notification. */
async function runNotificationDispatch(ctx: Ctx, p: { lookbackMinutes?: number; limit?: number; customerNamePrefix?: string }): Promise<void> {
  // Bounded scan window — no unbounded reads of the event feeds.
  const lookback = Math.max(1, Math.min(60 * 24, p.lookbackMinutes ?? 60))
  const limit = Math.max(1, Math.min(500, p.limit ?? 200))
  const cutoff = new Date(Date.now() - lookback * 60_000).toISOString()
  const events: DispatchEvent[] = []
  let orderEventsScanned = 0
  let driverEventsScanned = 0

  // 1) canonical ORDER_* events (authoritative feed, written inside the order transaction)
  const oshPath = `/rest/v1/order_status_history?select=order_number,to_status&changed_at=gte.${encodeURIComponent(cutoff)}&order=changed_at.desc&limit=${limit}`
  const osh = await rest(SERVICE, 'GET', oshPath)
  if (osh.status !== 200) throw new Error('order_status_history read failed: ' + osh.status)
  for (const h of (osh.j || []) as Array<{ order_number: string; to_status: string }>) {
    orderEventsScanned++
    const mapped = ORDER_EVENT_MAP[h.to_status]
    if (!mapped) continue // unapproved status → skip (documented, not invented)
    events.push({ id: `evt-ord-${h.order_number}-${h.to_status}`, orderNumber: h.order_number, eventType: mapped })
  }

  // 2) canonical DRIVER_* events (authoritative feed, driver-RPC-scoped)
  //    + id/driver_id/assigned_at/rider_pushed_at สำหรับ A2 rider push (แยก audience)
  const daPath = `/rest/v1/delivery_assignments?select=id,order_number,status,driver_id,assigned_at,rider_pushed_at&updated_at=gte.${encodeURIComponent(cutoff)}&status=in.(assigned,accepted,picked_up)&order=updated_at.desc&limit=${limit}`
  const da = await rest(SERVICE, 'GET', daPath)
  if (da.status !== 200) {
    // Read failure of the DRIVER_* feed must stay visible, but ORDER_* dispatch proceeds.
    ctx.errors.push('delivery_assignments read failed: ' + da.status)
  } else {
    for (const a of (da.j || []) as Array<{ order_number: string; status: string }>) {
      driverEventsScanned++
      const mapped = DRIVER_EVENT_MAP[a.status]
      if (!mapped) continue
      events.push({ id: `evt-drv-${a.order_number}-${a.status}`, orderNumber: a.order_number, eventType: mapped })
    }
  }

  if (events.length === 0) {
    ctx.results.notification_dispatch = { window_minutes: lookback, order_events: orderEventsScanned, driver_events: driverEventsScanned, created: [], duplicate: [], skipped: 0, suppressed: 0 }
    return
  }

  // 3) recipient resolution — Supabase stays the source of truth for identity
  // NOTE: PostgREST `in.(a,b)` list — commas must stay RAW; only each value is encoded.
  const numbers = [...new Set(events.map((e) => e.orderNumber))]
  let ordPath = `/rest/v1/orders?select=order_number,customer_id,customer_name&order_number=in.(${numbers.map(encodeURIComponent).join(',')})`
  if (p.customerNamePrefix) ordPath += `&customer_name=like.${encodeURIComponent(p.customerNamePrefix + '*')}`
  const ords = await rest(SERVICE, 'GET', ordPath)
  if (ords.status !== 200) throw new Error('orders read failed: ' + ords.status)
  const byOrder = new Map<string, { customer_id: string | null; customer_name: string | null }>()
  for (const o of (ords.j || []) as Array<{ order_number: string; customer_id: string | null; customer_name: string | null }>) byOrder.set(o.order_number, o)

  // 3b) identity resolution — orders.customer_id stores the AUTH USER uuid (create_order_with_items
  // writes v_uid::text); the canonical recipient id is public.customers.id (notifications FK).
  const userUuids = [...new Set([...byOrder.values()].map((o) => o.customer_id).filter((c): c is string => !!c))]
  const userToCustomer = new Map<string, string>()
  if (userUuids.length > 0) {
    const custPath = `/rest/v1/customers?select=id,user_id&user_id=in.(${userUuids.map(encodeURIComponent).join(',')})`
    const cres = await rest(SERVICE, 'GET', custPath)
    if (cres.status !== 200) throw new Error('customers read failed: ' + cres.status)
    for (const c of (cres.j || []) as Array<{ id: string; user_id: string | null }>) {
      if (c.user_id) userToCustomer.set(c.user_id, c.id)
    }
  }

  // 4) channel preference suppression (Transactional) — never notify suppressed customers
  const customerIds = [...new Set([...userToCustomer.values()])]
  const suppressed = new Set<string>()
  if (customerIds.length > 0) {
    const prefPath = `/rest/v1/notification_prefs?customer_id=in.(${customerIds.map(encodeURIComponent).join(',')})&select=customer_id,channels`
    const prefs = await rest(SERVICE, 'GET', prefPath)
    if (prefs.status === 200) {
      for (const pr of (prefs.j || []) as Array<{ customer_id: string; channels: Record<string, unknown> }>) {
        if (pr.channels && pr.channels.Transactional === false) suppressed.add(pr.customer_id)
      }
    } // prefs read failure → do NOT suppress (fail open), error stays visible in the trace
    else ctx.errors.push('notification_prefs read failed: ' + prefs.status)
  }

  const created: string[] = []
  const duplicate: string[] = []
  let skipped = 0
  let suppressedCount = 0
  for (const e of events) {
    const o = byOrder.get(e.orderNumber)
    const recipient = o && o.customer_id ? userToCustomer.get(o.customer_id) : undefined
    if (!o || !recipient) { skipped++; continue } // no canonical recipient → no invented recipient
    if (suppressed.has(recipient)) { suppressedCount++; continue }
    const copy = EVENT_COPY[e.eventType]
    const r = await notifyOnce(e.id, copy.title, copy.body({ orderNumber: e.orderNumber }), e.eventType, {
      customerId: recipient,
      category: 'Transactional',
    })
    if (r.startsWith('failed:')) ctx.errors.push(`notify ${e.id}: ${r}`)
    else ;(r === 'created' ? created : duplicate).push(e.id)
  }
  // W3-D-7: after a durable notification is CREATED, fan it out to the customer's
  // devices through push-send. Transport-only: the in-app row above remains the
  // single authority, and every failure is recorded in ctx.errors rather than
  // failing the job (a push outage must not roll back order notifications).
  if (PUSH_SEND_URL) {
    const pushed: string[] = []
    let pushErrors = 0
    for (const eventId of created) {
      const e = events.find((x) => x.id === eventId)
      const o = e ? byOrder.get(e.orderNumber) : undefined
      const recipient = o && o.customer_id ? userToCustomer.get(o.customer_id) : undefined
      if (!e || !recipient) continue
      const copy = EVENT_COPY[e.eventType]
      try {
        const res = await fetch(PUSH_SEND_URL, {
          method: 'POST',
          headers: {
            apikey: SERVICE,
            Authorization: 'Bearer ' + SERVICE,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId: recipient,
            title: copy.title,
            body: copy.body({ orderNumber: e.orderNumber }),
            url: '/notifications',
            tag: `bmb-${e.orderNumber}`,
            notificationId: eventId,
          }),
        })
        if (res.ok) pushed.push(eventId)
        else {
          pushErrors++
          if (pushErrors <= 3) ctx.errors.push(`push-send ${eventId}: HTTP ${res.status}`)
        }
      } catch (err: any) {
        pushErrors++
        if (pushErrors <= 3) ctx.errors.push(`push-send ${eventId}: ${err?.message ?? 'fetch failed'}`)
      }
    }
    ctx.results.notification_push = { attempted: created.length, pushed: pushed.length, errors: pushErrors }
  }

  // A2 (2026-10-20): RIDER push — คนละ audience กับลูกค้าอย่างชัดเจน
  //   เฉพาะงานที่ status='assigned' และยังไม่เคย push (rider_pushed_at IS NULL)
  //   claim แบบ atomic (PATCH ...&rider_pushed_at=is.null) → หนึ่งงาน = หนึ่ง push
  //   ถึงแม้ scan window จะทับซ้อนหลายรอบ · มอบหมายใหม่ = rider_pushed_at ถูก
  //   reset โดย assign_driver (132) → ไรเดอร์คนใหม่ได้รับแจ้งเตือนเอง
  //   push ล้มเหลว "ไม่แตะ" assignment/order เลย — polling ของ /rider ยังเป็น fallback
  if (PUSH_SEND_URL) {
    type RiderRow = { id: string; order_number: string; driver_id: string | null; rider_pushed_at: string | null }
    const riderRows = ((da.j || []) as RiderRow[]).filter(
      (a) => a.driver_id && !a.rider_pushed_at &&
             (da.j || []).some((x: { order_number: string; status: string }) => x.order_number === a.order_number && x.status === 'assigned'),
    )
    let riderPushed = 0
    let riderErrors = 0
    for (const a of riderRows) {
      try {
        const res = await fetch(PUSH_SEND_URL, {
          method: 'POST',
          headers: {
            apikey: SERVICE,
            Authorization: 'Bearer ' + SERVICE,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            driverId: a.driver_id,
            title: '🛵 มีงานใหม่',
            body: `ออเดอร์ ${a.order_number} มอบหมายให้คุณ — เปิดหน้างานจัดส่งเพื่อรับงาน`,
            url: '/rider',
            tag: `bmb-rider-${a.order_number}`,
          }),
        })
        if (res.ok) {
          riderPushed++
          // idempotency marker — สำเร็จค่อยเขียน; แถวถูกเขียนไปก่อน = ข้าม (กันซ้ำ)
          await rest(
            SERVICE,
            'PATCH',
            `/rest/v1/delivery_assignments?id=eq.${encodeURIComponent(a.id)}&rider_pushed_at=is.null`,
            { rider_pushed_at: new Date().toISOString() },
          )
        } else {
          riderErrors++
          if (riderErrors <= 3) ctx.errors.push(`rider-push ${a.order_number}: HTTP ${res.status}`)
        }
      } catch (err: any) {
        riderErrors++
        if (riderErrors <= 3) ctx.errors.push(`rider-push ${a.order_number}: ${err?.message ?? 'fetch failed'}`)
      }
    }
    ctx.results.rider_push = { attempted: riderRows.length, pushed: riderPushed, errors: riderErrors }
  }

  // E1 (2026-10-22): BROADCAST push สำหรับงานประกาศ (dispatch_offers) —
  //   งาน status='offered' ที่ยังไม่เคย push (rider_pushed_at IS NULL) → แจ้ง
  //   ไรเดอร์ "ทุกคน" ที่ผูกบัญชีแล้ว (drivers.user_id NOT NULL) — ใครมากดรับก่อน
  //   = จอง (claim_dispatch_offer atomic) · marker แบบเดียวกับงานมอบหมาย
  //   (push ก่อนค่อย mark — mark พลาด = push ซ้ำรอบหน้า (เบากว่าข่าวหาย))
  if (PUSH_SEND_URL) {
    type OfferRow = { id: string; order_number: string }
    let offerPushed = 0
    let offerErrors = 0
    const offRes = await rest(
      SERVICE,
      'GET',
      `/rest/v1/dispatch_offers?select=id,order_number&status=eq.offered&rider_pushed_at=is.null&updated_at=gte.${encodeURIComponent(cutoff)}&order=updated_at.desc&limit=${limit}`,
    )
    if (offRes.status !== 200) {
      ctx.errors.push('dispatch_offers read failed: ' + offRes.status)
    } else {
      const drvRes = await rest(SERVICE, 'GET', '/rest/v1/drivers?select=id&user_id=not.is.null')
      const driverIds: string[] = drvRes.status === 200
        ? ((drvRes.j || []) as Array<{ id: string }>).map((d) => d.id)
        : []
      if (drvRes.status !== 200) ctx.errors.push('drivers read failed: ' + drvRes.status)
      for (const o of ((offRes.j || []) as OfferRow[])) {
        for (const dId of driverIds) {
          try {
            const res = await fetch(PUSH_SEND_URL, {
              method: 'POST',
              headers: {
                apikey: SERVICE,
                Authorization: 'Bearer ' + SERVICE,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                driverId: dId,
                title: '📣 งานประกาศใหม่ — ใครรับก่อนได้ก่อน',
                body: `งานส่ง ${o.order_number} เปิดให้รับ — กดรับก่อนเพื่อน ได้งานไป`,
                url: '/rider',
                tag: `bmb-offer-${o.order_number}`,
              }),
            })
            if (res.ok) offerPushed++
            else {
              offerErrors++
              if (offerErrors <= 3) ctx.errors.push(`offer-push ${o.order_number}/${dId}: HTTP ${res.status}`)
            }
          } catch (err: any) {
            offerErrors++
            if (offerErrors <= 3) ctx.errors.push(`offer-push ${o.order_number}: ${err?.message ?? 'fetch failed'}`)
          }
        }
        if (driverIds.length > 0) {
          await rest(
            SERVICE,
            'PATCH',
            `/rest/v1/dispatch_offers?id=eq.${encodeURIComponent(o.id)}&rider_pushed_at=is.null`,
            { rider_pushed_at: new Date().toISOString() },
          )
        }
      }
    }
    ctx.results.offer_broadcast = { pushed: offerPushed, errors: offerErrors }
  }

  ctx.results.notification_dispatch = {
    window_minutes: lookback,
    order_events: orderEventsScanned,
    driver_events: driverEventsScanned,
    created,
    duplicate,
    skipped,
    suppressed: suppressedCount,
  }
}

// ============================================
// Part C (2026-10-22): marketing_publish — เผยแพร่โพสต์ที่ถึงเวลา
//   · เลือกเฉพาะ status='scheduled' และ scheduled_for <= now (จำกัดด้วย limit)
//   · ก่อนยิงทุกครั้งเช็ค approval ของโพสต์อีกรอบ (คนต้องอนุมัติแล้ว — ถ้าถูก
//     reject ภายหลัง = ข้าม + รายงาน ไม่โพสต์)
//   · เรียก social-publish-worker ของเดิม (publish จริงผ่าน Meta Graph) —
//     โพสต์เนื้อหา "ที่อนุมัติ" จาก content_approvals (single source)
//   · สำเร็จ = บันทึก provider_post_id + published_at · ล้ม = เก็บ error +
//     attempts (retry รอบถัดไป) · โพสต์ที่ไม่มี approval = ห้ามยิงเด็ดขาด
// ============================================
async function runMarketingPublish(ctx: Ctx, p: { limit?: number }) {
  const limit = Math.min(Math.max(Number(p.limit) || 10, 1), 50)
  const nowIso = new Date().toISOString()
  const due = await rest(
    SERVICE,
    'GET',
    `/rest/v1/marketing_posts?select=id,approval_id,image_urls,publish_attempts&status=eq.scheduled&scheduled_for=lte.${encodeURIComponent(nowIso)}&order=scheduled_for.asc&limit=${limit}`,
  )
  if (due.status !== 200) {
    ctx.errors.push('marketing_posts read failed: ' + due.status)
    return
  }
  const rows = ((due.j || []) as Array<{ id: string; approval_id: string | null; image_urls: string[] | null; publish_attempts: number }>)
  let published = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    // โพสต์ต้องมี approval ที่คนอนุมัติแล้ว — ไม่มี = ห้ามยิง (กันโพสต์ผี)
    if (!row.approval_id) {
      skipped++
      await rest(SERVICE, 'PATCH', `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
        status: 'failed', error: 'ERR_APPROVAL_REQUIRED', publish_attempts: row.publish_attempts + 1, updated_at: nowIso,
      })
      continue
    }
    const ap = await rest(SERVICE, 'GET', `/rest/v1/content_approvals?select=status&id=eq.${encodeURIComponent(row.approval_id)}`)
    const apStatus = ap.status === 200 && Array.isArray(ap.j) && ap.j.length > 0 ? (ap.j[0] as { status: string }).status : null
    if (apStatus !== 'approved') {
      skipped++
      await rest(SERVICE, 'PATCH', `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
        status: 'failed', error: 'ERR_APPROVAL_REQUIRED:' + (apStatus || 'missing'), publish_attempts: row.publish_attempts + 1, updated_at: nowIso,
      })
      continue
    }

    try {
      const res = await fetch(`${SB_URL}/functions/v1/social-publish-worker`, {
        method: 'POST',
        headers: {
          apikey: SERVICE,
          Authorization: 'Bearer ' + SERVICE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approvalId: row.approval_id, imageUrls: row.image_urls || [] }),
      })
      const j = await res.json().catch(() => ({} as Record<string, unknown>))
      const meta = (j as { meta?: { post_id?: string } }).meta
      if (res.ok && (j as { ok?: boolean }).ok) {
        published++
        await rest(SERVICE, 'PATCH', `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
          status: 'published',
          provider_post_id: meta?.post_id || null,
          published_at: new Date().toISOString(),
          error: null,
          publish_attempts: row.publish_attempts + 1,
          updated_at: new Date().toISOString(),
        })
      } else {
        // retry รอบถัดไป — โพสต์จริงไม่เกิดถ้าไม่ ok (ไม่โพสต์ซ้ำ)
        failed++
        await rest(SERVICE, 'PATCH', `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
          error: String((j as { detail?: string }).detail || (j as { error?: string }).error || ('HTTP ' + res.status)).slice(0, 500),
          publish_attempts: row.publish_attempts + 1,
          updated_at: new Date().toISOString(),
        })
        if (failed <= 3) ctx.errors.push(`marketing-publish ${row.id}: HTTP ${res.status}`)
      }
    } catch (err: unknown) {
      failed++
      await rest(SERVICE, 'PATCH', `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
        error: String(err instanceof Error ? err.message : err).slice(0, 500),
        publish_attempts: row.publish_attempts + 1,
        updated_at: new Date().toISOString(),
      })
      if (failed <= 3) ctx.errors.push(`marketing-publish ${row.id}: ${err instanceof Error ? err.message : 'fetch failed'}`)
    }
  }
  ctx.results.marketing_publish = { scanned: rows.length, published, failed, skipped }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // --- authentication: platform JWT + shared automation token ---
  const hdr = req.headers.get('x-automation-token') || ''
  if (!TOKEN) return json({ error: 'automation not configured (AUTOMATION_TOKEN missing)' }, 500)
  if (hdr !== TOKEN) return json({ error: 'unauthorized' }, 401)

  let payload: {
    job?: string; eventId?: string; maxAgeMinutes?: number; customerNamePrefix?: string; stockThreshold?: number;
    lookbackMinutes?: number; limit?: number
  }
  try { payload = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  const job = payload.job || ''
  if (!['orders_stale_pending', 'inventory_low_stock', 'notification_dispatch', 'marketing_publish'].includes(job)) return json({ error: 'unknown job' }, 400)

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
    else if (job === 'notification_dispatch') await runNotificationDispatch(ctx, payload)
    else if (job === 'marketing_publish') await runMarketingPublish(ctx, payload)
    else await runInventoryLowStock(ctx, payload)
  } catch (e) {
    ctx.errors.push(String(e && e instanceof Error ? e.message : e))
  }

  const status = ctx.errors.length === 0 ? 'succeeded' : (Object.keys(ctx.results).length ? 'partial' : 'failed')
  await recordExecution(ctx, status as 'succeeded' | 'failed' | 'partial')
  return json({ event_id: eventId, execution_id: ctx.executionId, status, results: ctx.results, errors: ctx.errors })
})

