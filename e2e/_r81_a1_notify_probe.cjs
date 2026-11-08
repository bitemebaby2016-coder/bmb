// ============================================
// BMB R81-A (A1) — notify-gap EVIDENCE probe (READ-ONLY · ไม่แก้ข้อมูลใด ๆ)
//   Owner 2026-11-08: B6 = "แจ้งเตือนจากเพจไม่ส่งถึงลูกค้า"
//   ดูของจริง 20 แถว social_events ล่าสุด (event_type=comment) → ตัด H1/H2/H3:
//     H2 = private_replies ถูก FB ปฏิเสธ (dm_error มีค่า) · H3 = ตอบสาธารณะล้ม (reply_status != sent)
//     H1 = ทุกอย่าง sent จริง (ไม่มี error ในระบบ) = ปัญหาฝั่ง FB (Message Requests / notification off)
//   Evidence: e2e/_r81_a1_evidence.json
// Usage: node e2e/_r81_a1_notify_probe.cjs
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB, SERVICE, api } = require('./wave2Lib.cjs')

async function main() {
  const out = {
    tool: 'r81-a1-notify-evidence',
    ts: new Date().toISOString(),
    safety: 'READ-ONLY select on social_events',
    rows: [],
  }
  if (!SERVICE) { out.fatal = 'SUPABASE_SERVICE_ROLE_KEY missing'; fs.writeFileSync(path.join(__dirname, '_r81_a1_evidence.json'), JSON.stringify(out, null, 2)); console.log('FATAL no service key'); process.exit(1) }

  const sel = 'event_id,sender_id,sender_name,platform,event_type,status,created_at,received_at,reply_status,reply_provider_id,ai_guardrail_flags,ai_reply_text'
  const q = await api(SERVICE, 'GET', `/rest/v1/social_events?platform=eq.FACEBOOK&event_type=eq.comment&order=created_at.desc&limit=20&select=${sel}`)
  if (q.status !== 200) { out.fatal = 'http_' + q.status + ' ' + JSON.stringify(q.j).slice(0, 300); console.log(out.fatal); process.exit(1) }

  const tally = { reply_status: {}, dm_ok: 0, dm_error: 0, dm_absent: 0, public_reply_sent: 0, no_reply_text: 0 }
  for (const r of q.j || []) {
    const flags = r.ai_guardrail_flags || {}
    const dmReply = 'dm_reply_id' in flags ? flags.dm_reply_id : '(absent)'
    const dmErr = 'dm_error' in flags ? flags.dm_error : '(absent)'
    const row = {
      created_at: r.created_at,
      event_id: r.event_id,
      sender: r.sender_name,
      status: r.status,
      reply_status: r.reply_status ?? '(absent)',
      reply_provider_id: r.reply_provider_id ?? '(absent)',
      dm_reply_id: dmReply,
      dm_error: dmErr,
      reply_len: r.ai_reply_text ? String(r.ai_reply_text).length : 0,
    }
    out.rows.push(row)
    tally.reply_status[String(row.reply_status)] = (tally.reply_status[String(row.reply_status)] || 0) + 1
    if (row.reply_status === 'sent') tally.public_reply_sent++
    if (row.reply_len === 0) tally.no_reply_text++
    if (dmReply === '(absent)' && dmErr === '(absent)') tally.dm_absent++
    else if (dmErr !== '(absent)' && dmErr !== null) tally.dm_error++
    else tally.dm_ok++
  }
  out.tally = tally
  // H-classification (ตามแผน R81-A)
  const h3 = tally.public_reply_sent < (q.j || []).length
  const h2 = tally.dm_error > 0
  out.hypothesis = {
    H3_public_reply_failing: h3 ? 'POSSIBLE — reply_status บางแถวไม่ใช่ sent' : 'NOT supported — ทุกแถว reply_status=sent',
    H2_private_reply_rejected: h2 ? 'CONFIRMED — มี dm_error จริง ' + tally.dm_error + ' แถว' : 'NOT supported — ไม่มี dm_error ใน 20 แถว',
    H1_fb_side: (!h3 && !h2) ? 'MOST LIKELY — ระบบส่งสำเร็จทุกช่อง อาการตกฝั่ง FB (Message Requests / notification off)' : 'needs more evidence',
  }
  fs.writeFileSync(path.join(__dirname, '_r81_a1_evidence.json'), JSON.stringify(out, null, 2))
  // console table (ไม่พิมพ์ key ใด ๆ)
  console.log('R81-A1 rows=' + out.rows.length + ' tally=' + JSON.stringify(tally))
  for (const r of out.rows) console.log([r.created_at, r.reply_status, 'dmId=' + String(r.dm_reply_id).slice(0, 18), 'dmErr=' + String(r.dm_error).slice(0, 40), r.reply_len].join(' | '))
  console.log('H: ' + JSON.stringify(out.hypothesis))
}

main().catch((e) => { console.error('R81_A1_FAIL', String(e).slice(0, 300)); process.exit(1) })