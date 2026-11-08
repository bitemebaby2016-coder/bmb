// ============================================
// BMB R81-A (A1b) — notify-gap EVIDENCE part 2 (READ-ONLY)
//   ต่อจาก _r81_a1_notify_probe: เห็น reply_status=failed 14/20 + dm_error http_400 5/5
//   → ดึงเหตุผลเต็ม ๆ: last_error (public reply fail) + dm_error ทั้งแถว (private reply fail)
//   Evidence: e2e/_r81_a1b_evidence.json
// Usage: node e2e/_r81_a1b_notify_probe.cjs
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SERVICE, api } = require('./wave2Lib.cjs')

async function main() {
  const out = { tool: 'r81-a1b-notify-reasons', ts: new Date().toISOString(), safety: 'READ-ONLY', rows: [] }
  if (!SERVICE) { console.log('FATAL no service key'); process.exit(1) }
  const sel = 'event_id,sender_name,status,attempts,last_error,last_attempt_at,reply_status,reply_provider_id,ai_guardrail_flags'
  const q = await api(SERVICE, 'GET', `/rest/v1/social_events?platform=eq.FACEBOOK&event_type=eq.comment&order=created_at.desc&limit=20&select=${sel}`)
  if (q.status !== 200) { console.log('FATAL http_' + q.status); process.exit(1) }
  const reasons = {}
  const dmReasons = {}
  for (const r of q.j || []) {
    const flags = r.ai_guardrail_flags || {}
    const row = {
      created_at: r.attempts != null ? undefined : undefined,
      event_id: r.event_id,
      sender: r.sender_name,
      status: r.status,
      attempts: r.attempts,
      reply_status: r.reply_status ?? '(absent)',
      last_error: r.last_error ?? '(absent)',
      dm_reply_id: 'dm_reply_id' in flags ? flags.dm_reply_id : '(absent)',
      dm_error: 'dm_error' in flags ? flags.dm_error : '(absent)',
    }
    out.rows.push(row)
    reasons[String(row.last_error)] = (reasons[String(row.last_error)] || 0) + 1
    if (row.dm_error !== '(absent)' && row.dm_error !== null) dmReasons[String(row.dm_error)] = (dmReasons[String(row.dm_error)] || 0) + 1
  }
  out.last_error_tally = reasons
  out.dm_error_tally = dmReasons
  fs.writeFileSync(path.join(__dirname, '_r81_a1b_evidence.json'), JSON.stringify(out, null, 2))
  console.log('LAST_ERROR tally: ' + JSON.stringify(reasons, null, 2))
  console.log('DM_ERROR tally: ' + JSON.stringify(dmReasons, null, 2))
  for (const r of out.rows) console.log([r.reply_status, 'att=' + r.attempts, 'st=' + r.status, 'err=' + String(r.last_error).slice(0, 90), 'dm=' + String(r.dm_error).slice(0, 90)].join(' | '))
}

main().catch((e) => { console.error('R81_A1B_FAIL', String(e).slice(0, 300)); process.exit(1) })