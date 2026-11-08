// ============================================
// BMB R81b — Owner live-test evidence (READ-ONLY production)
//   คำถามที่ต้องตอบจากหลักฐาน 2 กลุ่ม:
//   A) push ถึงลูกค้าไม่ดัง → event รอบนี้ flags.push_notify = อะไร? identity มีไหม?
//      outbox/notification มีแถวไหม? มี push_subscriptions ไหม?
//   B) ข้อมูลรอบ/เวลา/ประเภทออเดอร์ผิด (ไก่ทอด pre-order เลยรอบ → ใส่ตะกร้าให้)
//      → reply จริงพูดอะไร · rounds วันนี้สถานะอะไร · catalog はどう
//   ไม่เขียนอะไรทั้งสิ้น — GET อย่างเดียว · evidence: e2e/_r81b_evidence.json
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')

async function get(p) {
  try {
    const r = await fetch(SB + p, {
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    const text = await r.text()
    let j = null
    try { j = JSON.parse(text) } catch { /* not json */ }
    if (!r.ok) return { error: r.status, body: String(j && j.message || text).slice(0, 300) }
    return j
  } catch (e) {
    return { error: 'fetch', body: String(e).slice(0, 200) }
  }
}

async function main() {
  const out = { tool: 'r81b-live-evidence', ts: new Date().toISOString(), mode: 'READ_ONLY_GET' }
  const bangkok = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)

  out.events_recent = await get('/rest/v1/social_events?select=event_id,event_type,platform,sender_id,content,reply_status,reply_provider_id,ai_reply_text,ai_guardrail_flags,last_error,status,created_at,processed_at&order=created_at.desc&limit=15')
  out.identities = await get('/rest/v1/customer_channel_identities?select=channel,external_user_id,customer_ref,display_name,created_at&order=created_at.desc&limit=300')
  out.customers_sample = await get('/rest/v1/customers?select=*&limit=2')
  out.push_subscriptions_sample = await get('/rest/v1/push_subscriptions?select=*&limit=5')
  out.outbox_recent = await get('/rest/v1/notification_outbox?select=*&order=created_at.desc&limit=60')
  out.notifications_recent = await get('/rest/v1/notifications?select=*&order=created_at.desc&limit=40')
  out.rounds_today = await get('/rest/v1/delivery_rounds?scheduled_date=eq.' + bangkok + '&order=delivery_start.asc&select=*&limit=20')
  out.rounds_future = await get('/rest/v1/delivery_rounds?scheduled_date=gte.' + bangkok + '&order=scheduled_date.asc&select=id,round_key,display_name,status,scheduled_date,cutoff_time,pre_order_cutoff,delivery_start,delivery_end,current_count,max_capacity&limit=40')
  out.products = await get('/rest/v1/products?select=id,name,is_available,archived,category_id&archived=eq.false&limit=300')
  out.business_channels = await get('/rest/v1/business_settings?key=in.(notification_channels,store_status)&select=key,value&limit=5')

  // สรุปภาพรวม ให้อ่านง่าย
  const evs = Array.isArray(out.events_recent) ? out.events_recent : []
  out.summary = {
    bangkok_today: bangkok,
    event_count: evs.length,
    events: evs.map((e) => ({
      event_id: e.event_id,
      type: e.event_type,
      platform: e.platform,
      reply_status: e.reply_status,
      created_at: e.created_at,
      push_notify: (e.ai_guardrail_flags || {}).push_notify ?? null,
      dm_error: (e.ai_guardrail_flags || {}).dm_error ?? null,
      dm_attempted_at: (e.ai_guardrail_flags || {}).dm_attempted_at ?? null,
      content: String(e.content || '').slice(0, 80),
      reply: String(e.ai_reply_text || '').slice(0, 400),
    })),
    identity_count: Array.isArray(out.identities) ? out.identities.length : -1,
    identity_channels: Array.isArray(out.identities)
      ? [...new Set(out.identities.map((i) => i.channel + '/' + (i.external_user_id || '').slice(0, 6) + '…'))].slice(0, 20)
      : [],
    identity_real: Array.isArray(out.identities)
      ? out.identities.filter((i) => !String(i.external_user_id || '').startsWith('r74-')).map((i) => ({ ch: i.channel, ext: String(i.external_user_id || '').slice(0, 12) + '…', name: i.display_name, at: i.created_at })).slice(0, 30)
      : [],
    push_subscriptions: Array.isArray(out.push_subscriptions_sample)
      ? out.push_subscriptions_sample.map((s) => ({ keys: Object.keys(s), user: s.user_id || s.customer_id || null, endpoint: String(s.endpoint || '').slice(0, 60), created: s.created_at }))
      : out.push_subscriptions_sample,
    notifications_ai: Array.isArray(out.notifications_recent)
      ? out.notifications_recent.filter((n) => /ตอบคอมเมนต์|เอไอ|คอมเมนต์/.test(String(n.title || '') + String(n.body || '') + String(n.message || ''))).map((n) => ({ title: n.title, body: n.body, category: n.category, at: n.created_at }))
      : null,
    push_sub_rows: Array.isArray(out.push_subscriptions_sample) ? out.push_subscriptions_sample.length : String(out.push_subscriptions_sample),
    outbox_ai_reply: Array.isArray(out.outbox_recent)
      ? out.outbox_recent.filter((o) => String(o.event_key || '').startsWith('ai-comment-reply-')).map((o) => ({ key: o.event_key, status: o.status, ch: o.channel, err: String(o.last_error || '').slice(0, 120), created: o.created_at }))
      : out.outbox_recent,
    outbox_alerts_recent: Array.isArray(out.outbox_recent)
      ? out.outbox_recent.filter((o) => String(o.event_key || '').startsWith('social-')).map((o) => ({ key: o.event_key, status: o.status, ch: o.channel, created: o.created_at }))
      : null,
    round_count: Array.isArray(out.rounds_today) ? out.rounds_today.length : -1,
    rounds_today: Array.isArray(out.rounds_today)
      ? out.rounds_today.map((r) => ({ name: r.display_name, status: r.status, start: r.delivery_start, end: r.delivery_end, cutoff: r.pre_order_cutoff || r.cutoff_time, count: r.current_count, cap: r.max_capacity }))
      : out.rounds_today,
    rounds_future: Array.isArray(out.rounds_future)
      ? out.rounds_future.map((r) => ({ id: r.id, status: r.status, date: r.scheduled_date, cutoff: r.pre_order_cutoff || r.cutoff_time, start: r.delivery_start, count: r.current_count, cap: r.max_capacity }))
      : out.rounds_future,
    fried_chicken: Array.isArray(out.products)
      ? out.products.filter((p) => String(p.name || '').includes('ไก่ทอด')).map((p) => ({ id: p.id, name: p.name, avail: p.is_available, cat: p.category }))
      : [],
  }

  fs.writeFileSync(path.join(__dirname, '_r81b_evidence.json'), JSON.stringify(out, null, 2))
  console.log('R81B_EVIDENCE_WRITTEN events=' + out.summary.event_count +
    ' identities=' + out.summary.identity_count +
    ' pushsub=' + out.summary.push_sub_rows +
    ' rounds=' + out.summary.round_count)
  for (const e of out.summary.events.slice(0, 8)) {
    console.log('  · ' + e.created_at + ' ' + e.type + ' reply=' + e.reply_status + ' push=' + e.push_notify + ' | ' + e.content)
  }
  for (const o of out.summary.outbox_ai_reply || []) console.log('  OUTBOX ' + o.key + ' → ' + o.status + ' ' + (o.err || ''))
}

main().catch((e) => { console.error('R81B_FAIL', String(e).slice(0, 300)); process.exit(1) })