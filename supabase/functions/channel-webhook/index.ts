// ============================================
// Bite Me Baby â€” Edge Function: channel-webhook (W3-C-EXTERNAL)
// Facebook / Facebook Group / Messenger inbound adapter (foundation).
//
// Flow (server-authoritative, no client trust):
//   GET  â†’ webhook verification (hub.challenge + VERIFY_TOKEN)
//   POST â†’ X-Hub-Signature-256 (HMAC-SHA256 of raw body with APP_SECRET)
//        â†’ parse Meta events (object=page)
//        â†’ derive channel: MESSENGER (messaging) / FACEBOOK (page changes) /
//          FACEBOOK_GROUP (only when payload explicitly carries group id)
//          â€” never guessed; unknown origin â†’ rejected + audited
//        â†’ dedupe by event id (durable, audit_logs-backed)
//        â†’ identity resolution/provisioning (customer_channel_identities)
//        â†’ canonical order RPC (create_order_with_items w/ service path,
//          p_source_channel + p_external_ref_id + p_customer_ref)
//        â†’ audit trail
//
// Channel adapter has NO business authority: price/promo/capacity/mode/fee/
// payment/state are validated by the canonical backend RPC.
//
// Data minimization: never stores/returns app secret/tokens/page tokens.
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const APP_SECRET = Deno.env.get('CHANNEL_WEBHOOK_APP_SECRET') || ''
const VERIFY_TOKEN = Deno.env.get('CHANNEL_WEBHOOK_VERIFY_TOKEN') || ''

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

async function rest(key: string, method: string, path: string, body?: unknown, prefer?: string) {
  const headers: Record<string, string> = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
  if (prefer) headers['Prefer'] = prefer
  const r = await fetch(SB_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let j: any = null
  try { j = JSON.parse(text) } catch { /* empty */ }
  return { status: r.status, j }
}

async function restNoKey(method: string, path: string, body?: unknown) {
  const r = await fetch(SB_URL + path, {
    method,
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let j: any = null
  try { j = JSON.parse(text) } catch { /* empty */ }
  return { status: r.status, j }
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function audit(action: string, entityId: string, description: string, metadata: Record<string, unknown>) {
  await rest(SERVICE, 'POST', '/rest/v1/audit_logs', {
    id: 'cev-' + crypto.randomUUID(),
    action, entity_type: 'channel_event', entity_id: entityId, description, metadata,
  }, 'resolution=merge-duplicates')
}

/** Durable event dedupe: one logical external event = one logical effect. */
async function eventSeen(eventId: string): Promise<boolean> {
  const q = await rest(SERVICE, 'GET', `/rest/v1/audit_logs?action=eq.channel_event&entity_id=${encodeURIComponent(eventId)}&select=id&limit=1`)
  return q.status === 200 && Array.isArray(q.j) && q.j.length > 0
}

interface Ctx {
  eventId: string
  channel: string
  extUser: string
  results: Record<string, unknown>
  errors: string[]
}

/** Provision a canonical customer for a brand-new external identity (service path). */
async function provisionCustomer(extUser: string, channel: string): Promise<string | null> {
  const email = `ext-${extUser.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 40)}@channels.bmb.internal`
  const password = 'Ext-' + crypto.randomUUID().replace(/-/g, '') + '!7x'
  const su = await fetch(SB_URL + '/auth/v1/admin/users', {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (!su.ok) return null
  const uj = await su.json().catch(() => ({}))
  const uid = uj.id
  if (!uid) return null
  await rest(SERVICE, 'POST', '/rest/v1/customer_channel_identities', {
    channel, external_user_id: extUser, customer_ref: uid, display_name: null,
  }, 'resolution=ignore-duplicates')
  return uid
}

async function resolveCustomer(extUser: string, channel: string, ctx: Ctx): Promise<string | null> {
  const q = await rest(SERVICE, 'GET', `/rest/v1/customer_channel_identities?channel=eq.${encodeURIComponent(channel)}&external_user_id=eq.${encodeURIComponent(extUser)}&select=customer_ref&limit=1`)
  if (q.status === 200 && Array.isArray(q.j) && q.j.length > 0) return q.j[0].customer_ref
  const uid = await provisionCustomer(extUser, channel)
  if (!uid) {
    ctx.errors.push('identity provisioning failed for ' + extUser)
    return null
  }
  ctx.results.identity_provisioned = true
  return uid
}

/** Extract (channel, external_user_id, event_ref, orderPayload) from a Meta event. */
function parseEvent(obj: string, entry: any, ev: any): { channel: string; extUser: string; eventId: string; order: any | null } | { error: string } {
  if (Array.isArray(ev.messaging)) {
    const m = ev.messaging[0]
    if (!m) return { error: 'empty messaging event' }
    const extUser = m.sender && m.sender.id
    if (!extUser) return { error: 'missing sender id' }
    const mid = m.message && m.message.mid
    const eventId = (mid ? 'msg-' + mid : 'ev-' + (entry.id || 'unknown') + '-' + (m.timestamp || ev.time || '0'))
    let order: any = null
    const text = m.message && m.message.text
    if (typeof text === 'string' && text.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(text)
        if (parsed && parsed.order) order = parsed.order
      } catch { /* plain text chat â€” no order intent */ }
    }
    return { channel: 'MESSENGER', extUser, eventId, order }
  }
  if (Array.isArray(ev.changes)) {
    const ch = ev.changes[0]
    const value = ch && ch.value
    if (!value) return { error: 'empty change value' }
    const extUser = (value.from && (value.from.id || value.from.name)) || null
    const eventId = (value.post_id || value.comment_id || value.id || 'chg-' + (entry.id || 'unknown') + '-' + (ev.time || '0')) + ''
    // channel derivation ONLY from explicit metadata (never guessed)
    if (value.group_id) return { channel: 'FACEBOOK_GROUP', extUser, eventId, order: null }
    if (entry.id && value.item) return { channel: 'FACEBOOK', extUser: extUser || ('page-' + entry.id), eventId, order: null }
    return { error: 'cannot determine channel origin (missing group_id/item metadata)' }
  }
  return { error: 'unrecognized event shape' }
}

async function processEntry(obj: string, entry: any, ctx: Ctx) {
  const parsed = parseEvent(obj, entry, entry)
  if ('error' in parsed) {
    ctx.errors.push(parsed.error)
    await audit('channel_event_rejected', (parsed.error + ':' + (entry.id || 'unknown')).slice(0, 120), 'event rejected â€” ' + parsed.error, { object: obj })
    return
  }
  const { channel, extUser, eventId, order } = parsed as { channel: string; extUser: string; eventId: string; order: any | null }
  ctx.eventId = eventId
  ctx.channel = channel
  ctx.extUser = extUser

    // ===== G3: durable social event ingestion (Owner hard constraints) =====
  // Server-side page allowlist + tenant derivation (HC-1): page_id must be
  // bound in channel_page_bindings; tenant/brand derived in the RPC. The
  // caller (external webhook) NEVER supplies tenant identity. DB-level
  // idempotency UNIQUE(platform,event_id) (HC-4); NULL/empty identifiers
  // rejected by the RPC (HC-5). service_role is transport only - the
  // security boundary is HMAC + fail-closed secret + allowlist + validation
  // + DB uniqueness (HC-2).
  const eventType = channel === 'MESSENGER' ? 'message' : 'comment'
  const ingestRes = await restNoKey('POST', '/rest/v1/rpc/ingest_social_event', {
    p_platform: channel,
    p_event_id: eventId,
    p_page_id: entry.id || '',
    p_event_type: eventType,
    p_sender_id: extUser || null,
    p_sender_name: null,
    p_content: null,
    p_payload: entry,
  })
  if (ingestRes.status !== 200) {
    ctx.errors.push('social ingest http ' + ingestRes.status)
    await audit('channel_event_rejected', ('ingest-http:' + eventId).slice(0, 120), 'social event ingestion failed', { channel })
    return
  }
  const ingest = typeof ingestRes.j === 'string' ? ingestRes.j : (ingestRes.j && ingestRes.j[0])
  if (ingest === 'UNBOUND_PAGE') {
    ctx.results.page_unbound = true
    await audit('channel_event_rejected', ('page:' + (entry.id || 'unknown')).slice(0, 120), 'event rejected - page not in server-side allowlist', { channel })
    return
  }
  if (ingest === 'REJECTED') {
    ctx.results.ingest_rejected = true
    await audit('channel_event_rejected', ('invalid:' + eventId).slice(0, 120), 'event rejected - invalid identifiers/platform', { channel })
    return
  }
  ctx.results.social_event = ingest

  if (await eventSeen(eventId)) {
    ctx.results.duplicate_event = true
    await audit('channel_event_duplicate', eventId, 'duplicate external event â€” no new effect', { channel })
    return
  }

  const customerRef = await resolveCustomer(extUser, channel, ctx)
  if (!customerRef) return

  if (order && Array.isArray(order.items)) {
    const res = await restNoKey('POST', '/rest/v1/rpc/create_order_with_items', {
      p_items: order.items,
      p_delivery_round_id: order.delivery_round_id || null,
      p_delivery_method: order.delivery_method || 'self_delivery',
      p_delivery_address: order.delivery_address || 'à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸°à¸šà¸¸ (channel intake)',
      p_dropoff_latitude: order.dropoff_latitude ?? 10.7016,
      p_dropoff_longitude: order.dropoff_longitude ?? 102.1429,
      p_customer_name: order.customer_name || extUser,
      p_customer_phone: order.customer_phone || '',
      p_payment_method: order.payment_method || 'promptpay_qr',
      p_order_mode: order.order_mode || 'SAME_DAY',
      p_scheduled_date: order.scheduled_date || null,
      p_source_channel: channel,
      p_external_ref_id: eventId,
      p_customer_ref: customerRef,
    })
    ctx.results.order = {
      status: res.status,
      body: res.j && res.j.order_number ? { order_number: res.j.order_number, duplicate: !!res.j.duplicate } : res.j,
    }
  }
  await audit('channel_event', eventId, 'external event processed', {
    channel, external_user_id: extUser, order: ctx.results.order || null,
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })

  const url = new URL(req.url)

  // ===== webhook verification (Meta handshake) =====
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (!VERIFY_TOKEN) return json({ error: 'not configured (CHANNEL_WEBHOOK_VERIFY_TOKEN missing)' }, 500)
    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return json({ error: 'verification failed' }, 403)
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!APP_SECRET) return json({ error: 'not configured (CHANNEL_WEBHOOK_APP_SECRET missing)' }, 500)

  // ===== signature verification (raw body HMAC-SHA256) =====
  const raw = await req.text()
  const sig = req.headers.get('x-hub-signature-256') || ''
  const expected = 'sha256=' + (await hmacSha256Hex(APP_SECRET, raw))
  if (!sig || sig !== expected) {
    return json({ error: 'invalid signature' }, 401)
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch { return json({ error: 'invalid json' }, 400) }
  if (payload.object !== 'page' || !Array.isArray(payload.entry)) {
    return json({ error: 'unsupported object type' }, 400)
  }

  const out = []
  for (const entry of payload.entry) {
    const ctx: Ctx = { eventId: '', channel: '', extUser: '', results: {}, errors: [] }
    try {
      await processEntry(payload.object, entry, ctx)
    } catch (e) {
      ctx.errors.push(String(e && e instanceof Error ? e.message : e))
    }
    out.push({ entry_id: entry.id || null, channel: ctx.channel, event_id: ctx.eventId || null, results: ctx.results, errors: ctx.errors })
  }
  return json({ object: payload.object, processed: out.length, entries: out })
})



