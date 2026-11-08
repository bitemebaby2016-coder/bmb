// R82g evidence probe — READ-ONLY production (Owner retest 2026-11-08 ~10:57 BKK):
//   A2 = ยังไม่มี push ถึงเครื่อง Siam Portal (หลัง live mapping 03:50Z) → ดูแถว social_ai_events
//        + notification_outbox + push_subscriptions + identity ว่าขาดด่านไหน
//   B8/B9 = ข้อมูลรอบ/คัทออฟผิด → ดู business_settings (operating_hours/hours/order_policy) + delivery_rounds จริง
// เขียน e2e/_r82g_evidence.json — ห้ามมี write/POST ทุกกรณี
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB: URL0, SERVICE: KEY } = require('./wave2Lib.cjs')
const out = { probed_at: new Date().toISOString(), note: 'READ-ONLY R82g' }

async function q(label, pathq) {
  try {
    const r = await fetch(URL0 + pathq, {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    out[label] = { status: r.status, body: r.ok ? await r.json() : (await r.text()).slice(0, 400) }
  } catch (e) {
    out[label] = { error: String(e).slice(0, 300) }
  }
}

async function main() {
  // ---- A2: แถว AI ตั้งแต่ deploy (03:30Z) + แจ้งเตือน + subscription + identity ----
  await q('events_since_deploy',
    '/rest/v1/social_events?created_at=gte.2026-11-08T03:30:00Z' +
    '&select=id,created_at,event_type,platform,sender_id,sender_name,content,reply_status,last_error,ai_reply_text,ai_guardrail_flags' +
    '&order=created_at.desc&limit=12')
  await q('outbox_since_0300',
    '/rest/v1/notification_outbox?created_at=gte.2026-11-08T03:00:00Z' +
    '&select=*&order=created_at.desc&limit=20')
  await q('push_subs_siamportal',
    '/rest/v1/push_subscriptions?customer_id=eq.23cbe150-e5f4-4a37-a969-02e2db8df395&select=*&limit=5')
  await q('push_subs_recent_all',
    '/rest/v1/push_subscriptions?select=customer_id,created_at,updated_at,user_agent&order=updated_at.desc&limit=10')
  await q('identity_psid',
    '/rest/v1/customer_channel_identities?external_user_id=eq.28680684258210089&select=*&limit=5')
  await q('all_identities_facebook',
    '/rest/v1/customer_channel_identities?channel=in.(FACEBOOK,facebook)&select=id,channel,external_user_id,customer_ref,created_at&limit=20')

  // ---- B8/B9: กฎตั้งค่าจริง + รอบจริง ----
  await q('business_settings', '/rest/v1/business_settings?select=*&limit=20')
  await q('order_policy_table', '/rest/v1/order_policy?select=*&limit=10')
  await q('order_policy_view', '/rest/v1/order_policy_current?select=*&limit=5')
  await q('rounds_today_onwards',
    '/rest/v1/delivery_rounds?scheduled_date=gte.' + out_date() +
    '&select=*&order=scheduled_date.asc,delivery_start.asc&limit=30')
  await q('schedule_today_onwards',
    '/rest/v1/menu_schedule?is_published=eq.true&scheduled_date=gte.' + out_date() +
    '&select=product_id,scheduled_date,delivery_round_key&order=scheduled_date.asc&limit=60')

  const dest = path.join(__dirname, '_r82g_evidence.json')
  fs.writeFileSync(dest, JSON.stringify(out, null, 2))
  console.log('R82G_DONE → ' + dest)
  for (const k of Object.keys(out)) {
    if (k === 'probed_at' || k === 'note') continue
    const v = out[k]
    const n = Array.isArray(v && v.body) ? v.body.length : (v && v.status !== undefined ? v.status : 'ERR')
    console.log('  ' + k + ' = ' + (Array.isArray(v && v.body) ? n + ' rows' : 'HTTP ' + n))
  }
}
function out_date() { return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10) }

main().catch((e) => { console.error('PROBE_FAIL', e); process.exit(1) })