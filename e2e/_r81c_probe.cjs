// ============================================
// BMB R81c — resolve-chain probe (READ-ONLY)
//   ทำไม push ลูกค้า = unresolved_identity ทั้งที่ identity row มี?
//   ทดสอบ URL แบบมี/ไม่มี eq. · ตาม customer_ref → customers → push_subscriptions
//   + dump คำตอบเอไอ 15 รายการ ให้ตรวจข้อมูลรอบ/เวลา/ประเภทออเดอร์
//   evidence: e2e/_r81c_evidence.json
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')

async function get(p) {
  const r = await fetch(SB + p, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* ignore */ }
  return { status: r.status, j, raw: t.slice(0, 400) }
}

async function main() {
  const out = { tool: 'r81c-resolve-chain', ts: new Date().toISOString(), mode: 'READ_ONLY' }
  const PSID = '28680684258210089'

  // 1) URL syntax test — แบบมี eq. vs ไม่มี (แบบที่โค้ด R81 ใช้)
  out.lookup_with_eq = await get(`/rest/v1/customer_channel_identities?channel=eq.FACEBOOK&external_user_id=eq.${PSID}&select=customer_ref,external_user_id,display_name&limit=3`)
  out.lookup_without_eq = await get(`/rest/v1/customer_channel_identities?channel=eq.FACEBOOK&external_user_id=${PSID}&select=customer_ref,external_user_id,display_name&limit=3`)
  // แบบที่โค้ดใช้จริง (ไม่ encode dot อะไรเพิ่ม) + แบบ MESSENGER ด้วย
  out.lookup_messenger = await get(`/rest/v1/customer_channel_identities?channel=eq.MESSENGER&external_user_id=eq.${PSID}&select=customer_ref,external_user_id,display_name&limit=3`)

  const ref = (out.lookup_with_eq.j && out.lookup_with_eq.j[0] && out.lookup_with_eq.j[0].customer_ref) || null
  out.resolved_ref = ref

  if (ref) {
    // 2) customer_ref (auth uid) → customers.id (รู้คอลัมน์จริงก่อน = * แล้วค่อยเจาะ)
    out.customer_raw = await get(`/rest/v1/customers?user_id=eq.${ref}&select=*&limit=2`)
    const cid = out.customer_raw.j && out.customer_raw.j[0] && out.customer_raw.j[0].id
    out.customer_id = cid || null
    out.customer_cols = out.customer_raw.j && out.customer_raw.j[0] ? Object.keys(out.customer_raw.j[0]) : []
    if (cid) {
      // 3) subscription ของลูกค้าคนนี้
      out.my_subscriptions = await get(`/rest/v1/push_subscriptions?customer_id=eq.${cid}&select=id,endpoint,user_agent,last_success_at,last_failure_at,failure_count,created_at&limit=10`)
      // 4) notification/outbox ที่เคย enqueue ให้ลูกค้าคนนี้
      out.my_outbox = await get(`/rest/v1/notification_outbox?customer_id=eq.${cid}&order=created_at.desc&select=event_key,status,channel,attempts,last_error,created_at&limit=15`)
      out.my_notifications = await get(`/rest/v1/notifications?customer_id=eq.${cid}&order=created_at.desc&select=*&limit=10`)
    }
  }

  // 5) dump คำตอบทั้ง 15 เพื่อตรวจข้อมูลรอบ/เวลา/ประเภท
  const evs = await get('/rest/v1/social_events?select=event_id,event_type,platform,sender_id,content,reply_status,ai_reply_text,ai_guardrail_flags,created_at&order=created_at.desc&limit=15')
  out.replies = Array.isArray(evs.j) ? evs.j.map((e) => ({
    at: e.created_at, type: e.event_type, platform: e.platform, reply: e.reply_status,
    push: (e.ai_guardrail_flags || {}).push_notify ?? null,
    content: String(e.content || '').slice(0, 100),
    text: String(e.ai_reply_text || '').slice(0, 700),
  })) : evs

  fs.writeFileSync(path.join(__dirname, '_r81c_evidence.json'), JSON.stringify(out, null, 2))
  console.log('R81C: lookup_with_eq=' + out.lookup_with_eq.status + ' rows=' + (Array.isArray(out.lookup_with_eq.j) ? out.lookup_with_eq.j.length : -1))
  console.log('R81C: lookup_without_eq=' + out.lookup_without_eq.status + ' raw=' + out.lookup_without_eq.raw.slice(0, 160))
  console.log('R81C: lookup_messenger=' + out.lookup_messenger.status + ' rows=' + (Array.isArray(out.lookup_messenger.j) ? out.lookup_messenger.j.length : -1))
  console.log('R81C: customer_id=' + (out.customer_id || 'NONE') + ' cols=' + (out.customer_cols || []).join('|'))
  console.log('R81C: subs=' + (out.my_subscriptions ? (Array.isArray(out.my_subscriptions.j) ? out.my_subscriptions.j.length : out.my_subscriptions.status) : 'n/a'))
  console.log('R81C: outbox=' + (out.my_outbox ? (Array.isArray(out.my_outbox.j) ? out.my_outbox.j.length : out.my_outbox.status) : 'n/a'))
  console.log('R81C: replies=' + (Array.isArray(out.replies) ? out.replies.length : -1))
}

main().catch((e) => { console.error('R81C_FAIL', String(e).slice(0, 300)); process.exit(1) })