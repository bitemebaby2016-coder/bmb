// ============================================
// Bite Me Baby — Edge Function: notification-dispatcher (R48 · Unified Notification Hub)
// ============================================
// tick = ① builders (event 3 กลุ่ม → notification_outbox · idempotent ด้วย event_key)
//        ② drain (claim แถว due → buildChannelPlan → web_push → messenger → line[mock/live])
// Boundary (R48: ห้ามรบกวน Core Business Logic): อ่าน orders/loyalty อย่างเดียว · ไม่สร้าง
//   notification in-app ซ้ำ (in-app = automation-worker ตัวเดิม · ที่นี่ = TRANSPORT เท่านั้น)
// Loop safety: builders = INSERT ON CONFLICT (event_key) · drain = status machine
//   (pending/failed due → sending → sent/mock/dead · attempts >= 5 = dead)
// Auth: verify_jwt=false (pg_net) + x-automation-token = AUTOMATION_TOKEN (constant-time)
// Env: SUPABASE_URL/SERVICE (auto) · AUTOMATION_TOKEN · META_PAGE_ACCESS_TOKEN (messenger)
// Cron: pg_cron bmb-notify */5 → pg_net → bmb_notify_http (m178 pattern · stack จริง = GH+pg_cron+EF)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { buildChannelPlan, normalizeChannelFlags, DEFAULT_CHANNEL_FLAGS } from '../_shared/notificationPlan.ts'

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
// รับได้ 2 คีย์: AUTOMATION_TOKEN (ใช้ร่วมกับ queue/worker path เดิม) · BMB_NOTIFY_TOKEN
// (token เฉพาะของ cron `bmb-notify` — ตั้งตอน apply m179 แบบ r41g · สลับได้ไม่แตะโค้ด)
const TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''
const NOTIFY_TOKEN = Deno.env.get('BMB_NOTIFY_TOKEN') || ''
const META_PAGE = Deno.env.get('META_PAGE_ACCESS_TOKEN') || ''

type Sb = ReturnType<typeof createClient>

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

function tokenMatches(provided: string): boolean {
  if (!provided) return false
  for (const known of [TOKEN, NOTIFY_TOKEN]) {
    if (!known || provided.length !== known.length) continue
    let diff = 0
    for (let i = 0; i < known.length; i++) diff |= provided.charCodeAt(i) ^ known.charCodeAt(i)
    if (diff === 0) return true
  }
  return false
}

async function rpc(sb: Sb, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await sb.rpc(fn, args as never)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

interface OutboxRow {
  id: string
  event_key: string
  customer_id: string
  category: string
  title: string
  body: string
  url: string | null
  attempts: number
}

interface BuildResult { builder: string; count: number; skipped?: string }

async function enqueueOnce(
  sb: Sb, eventKey: string, customerId: string, category: string,
  title: string, body: string, url?: string,
): Promise<boolean> {
  const res = await rpc(sb, 'enqueue_notification', {
    p_event_key: eventKey, p_customer_id: customerId, p_category: category,
    p_title: title, p_body: body, p_url: url ?? null,
  }) as { ok?: boolean; inserted?: boolean }
  return !!res?.inserted
}

async function hasCol(sb: Sb, table: string, col: string): Promise<boolean> {
  try {
    const { data, error } = await sb.schema('public').from('information_schema.columns')
      .select('column_name').eq('table_name', table).eq('column_name', col)
    if (error) return false
    return Array.isArray(data) && data.length > 0
  } catch { return false }
}

// --- ① BUILDERS (idempotent ด้วย event_key · defensive = คอลัมน์ไม่ครบ = skip+เหตุผล) ---

/** T-Transactional: แถว notifications ใหม่ (automation-worker เขียน) → outbox เพื่อส่งออกช่องทางจริง */
async function buildFromNotifications(sb: Sb): Promise<BuildResult> {
  try {
    const { data, error } = await sb.from('notifications').select('*')
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .not('customer_id', 'is', null)
      .order('created_at', { ascending: false }).limit(100)
    if (error) return { builder: 'transactional_notifications', count: 0, skipped: error.message.slice(0, 120) }
    let n = 0
    for (const r of (data || []) as Array<Record<string, unknown>>) {
      const id = String(r.id ?? '')
      const cid = String(r.customer_id ?? '')
      if (!id || !cid) continue
      if (await enqueueOnce(sb, `ntf-${id}`, cid, String(r.category ?? 'Transactional'),
        String(r.title ?? 'การแจ้งเตือนจากร้าน'), String(r.message ?? r.body ?? ''), '/notifications')) n++
    }
    return { builder: 'transactional_notifications', count: n }
  } catch (e) {
    return { builder: 'transactional_notifications', count: 0, skipped: String(e).slice(0, 120) }
  }
}

/** T-Transactional: เตือนพรีออเดอร์ล่วงหน้า 1 วัน (scheduled_date = พรุ่งนี้) */
async function buildPreOrderReminders(sb: Sb): Promise<BuildResult> {
  try {
    for (const c of ['order_mode', 'scheduled_date', 'customer_id', 'status']) {
      if (!(await hasCol(sb, 'orders', c))) return { builder: 'preorder_reminder', count: 0, skipped: `orders missing column ${c}` }
    }
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)
    const { data, error } = await sb.from('orders')
      .select('id, order_number, customer_id, scheduled_date, status, order_mode')
      .eq('order_mode', 'PRE_ORDER').eq('scheduled_date', tomorrow)
      .in('status', ['confirmed', 'preparing', 'ready_for_dispatch', 'dispatched'])
      .not('customer_id', 'is', null).limit(100)
    if (error) return { builder: 'preorder_reminder', count: 0, skipped: error.message.slice(0, 120) }
    let n = 0
    for (const r of (data || []) as Array<Record<string, unknown>>) {
      if (await enqueueOnce(sb, `remind-${String(r.id)}-${tomorrow}`, String(r.customer_id), 'Transactional',
        '⏰ พรุ่งนี้ได้ทานแล้ว!',
        `ออเดอร์ ${String(r.order_number ?? r.id)} รอบส่งวันพรุ่งนี้ (${tomorrow}) — เตรียมที่อยู่ให้เรียบร้อย ขอบคุณที่รอค่ะ`,
        '/track')) n++
    }
    return { builder: 'preorder_reminder', count: n }
  } catch (e) {
    return { builder: 'preorder_reminder', count: 0, skipped: String(e).slice(0, 120) }
  }
}
/** B-Behavioral: Re-engagement 14/30 วัน (นับจากออเดอร์ล่าสุดของลูกค้า) */
async function buildReengagement(sb: Sb): Promise<BuildResult> {
  try {
    if (!(await hasCol(sb, 'orders', 'customer_id'))) {
      return { builder: 'reengagement_14_30', count: 0, skipped: 'orders missing customer_id' }
    }
    const { data, error } = await sb.from('orders')
      .select('customer_id, created_at')
      .gte('created_at', new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString())
      .not('customer_id', 'is', null)
      .order('created_at', { ascending: false }).limit(500)
    if (error) return { builder: 'reengagement_14_30', count: 0, skipped: error.message.slice(0, 120) }
    const last = new Map<string, string>()
    for (const r of (data || []) as Array<{ customer_id: string; created_at: string }>) {
      if (!last.has(r.customer_id)) last.set(r.customer_id, r.created_at)
    }
    const dayMs = 24 * 3600 * 1000
    let n = 0
    for (const [cid, iso] of last) {
      const idle = Math.floor((Date.now() - new Date(iso).getTime()) / dayMs)
      if (idle !== 14 && idle !== 30) continue
      if (await enqueueOnce(sb, `reeng-${cid}-${idle}`, cid, 'Marketing',
        idle === 14 ? '😋 คิดถึงจัง — เมนูใหม่รอนี่อยู่' : '🎉 ครบ 1 เดือนพอดี! กลับมาทานของอร่อยกันเถอะ',
        idle === 14 ? 'ไม่ได้เจอกัน 2 สัปดาห์ — เมนูประจำวันรออยู่ที่ biteme-baby.com/shop ค่ะ'
                    : 'แวะดูเมนูวันนี้ได้เลยที่ biteme-baby.com/shop ค่ะ',
        '/shop')) n++
    }
    return { builder: 'reengagement_14_30', count: n }
  } catch (e) {
    return { builder: 'reengagement_14_30', count: 0, skipped: String(e).slice(0, 120) }
  }
}

/** M-Marketing: ได้แต้มใหม่ (loyalty_points ภายใน 24 ชม.) */
async function buildPointsEarn(sb: Sb): Promise<BuildResult> {
  try {
    const { data, error } = await sb.from('loyalty_points').select('*')
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()).limit(50)
    if (error) return { builder: 'points_earn', count: 0, skipped: error.message.slice(0, 120) }
    let n = 0
    for (const r of (data || []) as Array<Record<string, unknown>>) {
      const cid = String(r.customer_id ?? r.customer_ref ?? '')
      const pts = Number(r.points ?? 0)
      const rid = String(r.id ?? `${r.created_at}-${cid}`)
      if (!cid || !pts || pts <= 0) continue
      if (await enqueueOnce(sb, `pts-${rid}`, cid, 'Marketing',
        `⭐ ได้แต้มสะสม +${pts} แต้มแล้ว`,
        `ยอดสะสมของคุณเพิ่ม ${pts} แต้ม — ใช้แลกของอร่อยได้ที่หน้าร้านค่ะ`, '/rewards')) n++
    }
    return { builder: 'points_earn', count: n }
  } catch (e) {
    return { builder: 'points_earn', count: 0, skipped: String(e).slice(0, 120) }
  }
}

/** B-Behavioral: Abandoned cart 15-30 นาที — ยังไม่ทำ (ZERO-FAKE): ตะกร้าอยู่ localStorage
 *  client เท่านั้น ไม่มี server cart ให้สแกน → ต้องมี cart_sessions ก่อน (บันทึก TEST_PACK §S) */
function buildAbandonedCart(): BuildResult {
  return { builder: 'abandoned_cart_15_30m', count: 0, skipped: 'no_server_cart_source (bmb-cart-v1 = localStorage · ต้องมี cart_sessions ก่อน — ไม่ปลอมข้อมูล)' }
}

/** B-Behavioral: Peak hour prompt — flag-off รอ Owner อนุมัติข้อความ/เวลา (ไม่ยิงมั่ว) */
function buildPeakHourPrompt(): BuildResult {
  return { builder: 'peak_hour_prompt', count: 0, skipped: 'flag_off (รอ Owner อนุมัติ copy+ช่วงเวลา — ไม่ hardcode มั่ว)' }
}
// --- ② DRAIN — claim → buildChannelPlan → web_push → messenger → line(mock/live) → complete ---

async function sendWebPush(sb: Sb, row: OutboxRow): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(`${SB_URL}/functions/v1/push-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'x-automation-token': TOKEN },
      body: JSON.stringify({ customerId: row.customer_id, title: row.title, body: row.body, url: row.url || '/notifications', tag: row.event_key }),
      signal: AbortSignal.timeout(20000),
    })
    const j: Record<string, unknown> | null = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, reason: `push_http_${res.status}` }
    // push-send = {ok, sent, skipped?} — skipped = ปิด push/ไม่มีอุปกรณ์ → fallback ช่องทางถัดไป
    const sent = Number(j?.sent ?? 0)
    if (sent > 0) return { ok: true }
    return { ok: false, reason: j?.skipped ? String(j.skipped) : 'push_sent_0' }
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 80) }
  }
}

async function sendMessenger(row: OutboxRow, psid: string): Promise<{ ok: boolean; reason?: string }> {
  if (!META_PAGE) return { ok: false, reason: 'no_page_token' }
  try {
    const text = `${row.title}\n${row.body || ''}`.trim()
    const res = await fetch('https://graph.facebook.com/v21.0/me/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + META_PAGE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, message: { text: text.slice(0, 1800) } }),
      signal: AbortSignal.timeout(15000),
    })
    const j: Record<string, unknown> | null = await res.json().catch(() => null)
    if (!res.ok || !j || !j.message_id) return { ok: false, reason: `graph_${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 80) }
  }
}

async function drainOutbox(sb: Sb): Promise<Record<string, number>> {
  const stats = { claimed: 0, sent: 0, failed: 0, dead: 0, mock: 0 }

  let flags = DEFAULT_CHANNEL_FLAGS
  try {
    const { data } = await sb.from('business_settings').select('value').eq('key', 'notification_channels').maybeSingle()
    flags = normalizeChannelFlags((data as { value?: unknown } | null)?.value)
  } catch { flags = DEFAULT_CHANNEL_FLAGS }

  const claimed = await rpc(sb, 'claim_notification_outbox', { p_limit: 25 }) as OutboxRow[] | null
  const rows = Array.isArray(claimed) ? claimed : []
  stats.claimed = rows.length

  for (const row of rows) {
    let hasPushSub = false
    let hasMessengerId = false
    let pushEnabled = true
    let categoryEnabled = true
    let psid = ''
    try {
      const [sub, ident, prefs] = await Promise.all([
        sb.from('push_subscriptions').select('id').eq('customer_id', row.customer_id).lt('failure_count', 10).limit(1),
        sb.from('channel_identities').select('external_id').eq('customer_id', row.customer_id).eq('channel', 'messenger').eq('status', 'active').limit(1),
        sb.from('notification_prefs').select('channels, push_enabled').eq('customer_id', row.customer_id).maybeSingle(),
      ])
      hasPushSub = !sub.error && (sub.data?.length ?? 0) > 0
      hasMessengerId = !ident.error && (ident.data?.length ?? 0) > 0
      psid = ident.data?.[0]?.external_id ?? ''
      if (prefs.data) {
        const ch = (prefs.data.channels ?? {}) as Record<string, boolean>
        categoryEnabled = ch[row.category] !== false
        pushEnabled = prefs.data.push_enabled !== false
      }
    } catch { /* bindings ขาด = แผนคับแคบลงเอง */ }

    const plan = buildChannelPlan(flags, { hasPushSub, hasMessengerId, pushEnabled, categoryEnabled })

    if (plan.steps.length === 0) {
      if (plan.mockIfNone) {
        await rpc(sb, 'complete_notification', { p_id: row.id, p_ok: false, p_channel: 'line', p_error: null, p_final: 'mock' })
        stats.mock++
      } else {
        await rpc(sb, 'complete_notification', { p_id: row.id, p_ok: false, p_channel: null, p_error: 'category_disabled', p_final: 'dead' })
        stats.dead++
      }
      continue
    }

    let lastErr = ''
    let done = false
    for (const step of plan.steps) {
      let r: { ok: boolean; reason?: string }
      if (step.channel === 'web_push') r = await sendWebPush(sb, row)
      else if (step.channel === 'messenger') r = psid ? await sendMessenger(row, psid) : { ok: false, reason: 'no_psid' }
      // line: เข้า plan เฉพาะ mode 'live' — ผู้ส่งจริงต่อยังไม่มี (รอ API อนุมัติ) = fail ชัดเจน ไม่เงียบ
      else r = { ok: false, reason: 'line_sender_not_configured' }
      if (r.ok) {
        await rpc(sb, 'complete_notification', { p_id: row.id, p_ok: true, p_channel: step.channel, p_error: null, p_final: null })
        stats.sent++
        done = true
        break
      }
      lastErr = `${step.channel}: ${r.reason || 'failed'}`
    }
    if (!done) {
      await rpc(sb, 'complete_notification', { p_id: row.id, p_ok: false, p_channel: null, p_error: lastErr || 'all_channels_failed', p_final: null })
      stats.failed++
    }
  }
  return stats
}
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-token',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    } })
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  const provided = req.headers.get('x-automation-token') || ''
  const authHeader = req.headers.get('authorization') || ''
  const hasServiceKey = SERVICE !== '' && authHeader === `Bearer ${SERVICE}`
  if (!hasServiceKey && !tokenMatches(provided)) return json({ error: 'unauthorized' }, 401)

  try {
    let body: { job?: string } = {}
    try { body = await req.json() } catch { /* ไม่มี body = tick */ }
    const job = body.job || 'tick'
    if (job !== 'tick') return json({ error: 'ERR_INVALID_JOB' }, 400)

    const sb = createClient(SB_URL, SERVICE, { auth: { persistSession: false } })
    const built: BuildResult[] = [
      await buildFromNotifications(sb),
      await buildPreOrderReminders(sb),
      await buildReengagement(sb),
      await buildPointsEarn(sb),
      buildAbandonedCart(),
      buildPeakHourPrompt(),
    ]
    const drain = await drainOutbox(sb)
    return json({ ok: true, job, built, drain, at: new Date().toISOString() })
  } catch (e) {
    return json({ error: 'ERR_UNCAUGHT', detail: String(e instanceof Error ? e.message : e).slice(0, 300) }, 500)
  }
})