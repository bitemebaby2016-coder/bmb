// ============================================
// BMB R81-A (A1c) — Graph READ-ONLY probe: คอมเมนต์ 20 แถวล่าสุดยังอยู่บน FB ไหม?
//   หลักฐานจาก A1/A1b: reply_status=failed 14/20 (META_SEND:http_400) + dm_error 5/5
//   ("Unsupported post request. Object with ID '...' does not exist")
//   → ถาม Graph แบบ READ-ONLY ว่า object จริงมีอยู่ไหม · can_comment / can_reply_privately ค่าอะไร
//   ไม่มี POST ใด ๆ — ปลอดภัย (ไม่แตะ content บน Facebook)
//   Evidence: e2e/_r81_a1c_evidence.json
// Usage: node e2e/_r81_a1c_graph_probe.cjs
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SERVICE, S, api } = require('./wave2Lib.cjs')

const GRAPH = 'https://graph.facebook.com/v21.0'
const TOK = S.META_PAGE_ACCESS_TOKEN

async function gget(id, fields) {
  const r = await fetch(`${GRAPH}/${id}?fields=${fields}&access_token=${encodeURIComponent(TOK)}`, { signal: AbortSignal.timeout(15000) })
  const j = await r.json().catch(() => null)
  return { http: r.status, j }
}

async function main() {
  const out = { tool: 'r81-a1c-graph-readonly', ts: new Date().toISOString(), safety: 'GET only — no POST/delete', rows: [] }
  if (!TOK) { console.log('FATAL no META_PAGE_ACCESS_TOKEN'); process.exit(1) }
  const sel = 'event_id,reply_status,last_error,ai_guardrail_flags'
  const q = await api(SERVICE, 'GET', `/rest/v1/social_events?platform=eq.FACEBOOK&event_type=eq.comment&order=created_at.desc&limit=20&select=${sel}`)
  if (q.status !== 200) { console.log('FATAL http_' + q.status); process.exit(1) }
  for (const r of q.j || []) {
    const g = await gget(r.event_id, 'id,type,message,from{id,name},can_comment,can_reply_privately,parent{id},created_time')
    const flags = r.ai_guardrail_flags || {}
    const row = {
      event_id: r.event_id,
      reply_status: r.reply_status ?? '(absent)',
      last_error: r.last_error ?? '(absent)',
      dm_error: 'dm_error' in flags ? flags.dm_error : '(absent)',
      graph_http: g.http,
      graph_error: g.j && g.j.error ? String(g.j.error.message).slice(0, 140) : null,
      can_comment: g.j ? g.j.can_comment : null,
      can_reply_privately: g.j ? g.j.can_reply_privately : null,
      type: g.j ? g.j.type : null,
      from: g.j && g.j.from ? g.j.from.name : null,
      parent: g.j && g.j.parent ? g.j.parent.id : null,
      created_time: g.j ? g.j.created_time : null,
    }
    out.rows.push(row)
    console.log([row.reply_status, 'g=' + row.graph_http, 'canC=' + row.can_comment, 'canPriv=' + row.can_reply_privately, 'type=' + row.type, 'err=' + (row.graph_error || '-'), 'lastErr=' + String(row.last_error).slice(0, 30)].join(' | '))
    await new Promise((res) => setTimeout(res, 300))
  }
  const tally = {}
  for (const r of out.rows) {
    const k = 'http' + r.graph_http + (r.graph_error ? ':' + r.graph_error.slice(0, 50) : '')
    tally[k] = (tally[k] || 0) + 1
  }
  out.tally = tally
  fs.writeFileSync(path.join(__dirname, '_r81_a1c_evidence.json'), JSON.stringify(out, null, 2))
  console.log('TALLY ' + JSON.stringify(tally, null, 2))
}

main().catch((e) => { console.error('R81_A1C_FAIL', String(e).slice(0, 300)); process.exit(1) })