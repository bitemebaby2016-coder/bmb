// ============================================
// BMB R76 — private_replies endpoint SHAPE probe (SAFE · ไม่แตะผู้ใช้จริง)
//   Owner 2026-11-07: "เวลาเอไอตอบโพสหรือข้อความ ต้องมีแจ้งเตือนเฟซบุ้คให้ลูกค้าด้วย"
//   ตรวจ 2 อย่าง:
//   ① POST /{FAKE comment id}/private_replies — อ่าน "รูปแบบ" ของ error:
//      "Unknown path components" = endpoint ถูกถอดแล้ว · อย่างอื่น (200/100/permission)
//      = endpoint ยังอยู่ (fake id = ไม่มี side effect ใด ๆ)
//   ② GET /{comment id จริง}?fields=can_reply_privately — READ-ONLY
// Evidence: e2e/_r76_privreply_shape.json
// ============================================
'use strict'
const fs = require('fs')
const { SB, S } = require('./wave2Lib.cjs')

const GRAPH = 'https://graph.facebook.com/v21.0'
const TOK = S.META_PAGE_ACCESS_TOKEN
const SERVICE = S.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  const out = { tool: 'r76-private-reply-shape', ts: new Date().toISOString(), safety: 'fake comment id only + read-only GET' }
  if (!TOK) { out.fatal = 'META_PAGE_ACCESS_TOKEN missing'; fs.writeFileSync('e2e/_r76_privreply_shape.json', JSON.stringify(out, null, 2)); console.log(out.fatal); process.exit(1) }

  // ① endpoint shape — FAKE id (ห้ามใช้ comment จริง)
  const fake = '1234567890123456_9999999999999999'
  const r1 = await fetch(`${GRAPH}/${fake}/private_replies`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'shape-probe' }),
    signal: AbortSignal.timeout(15000),
  })
  const j1 = await r1.json().catch(() => null)
  out.fake_post = { http: r1.status, error: (j1 && j1.error) || j1 || null }

  // ② read-only — หา comment id จริงจาก social_events (id รูปแบบเฟซ = ตัวเลข/ตัวเลข_ตัวเลข)
  const q = await fetch(`${SB}/rest/v1/social_events?platform=eq.FACEBOOK&event_type=eq.comment&order=created_at.desc&limit=20&select=event_id,sender_name`, {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
    signal: AbortSignal.timeout(15000),
  })
  const rows = await q.json().catch(() => [])
  const real = Array.isArray(rows) ? rows.find((r) => /^\d+(_\d+)?$/.test(String(r.event_id))) : null
  if (real) {
    const r2 = await fetch(`${GRAPH}/${real.event_id}?fields=can_reply_privately,can_comment&access_token=${encodeURIComponent(TOK)}`, { signal: AbortSignal.timeout(15000) })
    const j2 = await r2.json().catch(() => null)
    out.real_comment = { http: r2.status, sender: real.sender_name, can_reply_privately: j2 ? j2.can_reply_privately : null, can_comment: j2 ? j2.can_comment : null, error: (j2 && j2.error) || null }
  } else {
    out.real_comment = { skipped: 'no real-format comment id in social_events' }
  }

  fs.writeFileSync('e2e/_r76_privreply_shape.json', JSON.stringify(out, null, 2))
  console.log('R76_SHAPE ' + JSON.stringify(out))
}

main().catch((e) => { console.error('R76_SHAPE_FAIL', e); process.exit(1) })