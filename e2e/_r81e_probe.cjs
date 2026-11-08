// ============================================
// BMB R81e — อุปกรณ์ที่มี subscription เป็นของใคร (READ-ONLY)
//   คำถามสำหรับ Owner: บัญชีไหนที่มือถือ log in อยู่ → ใช้ผูก identity FB ให้เสียงดังได้
//   evidence: e2e/_r81e_evidence.json
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
  return { status: r.status, j, raw: t.slice(0, 300) }
}

async function main() {
  const out = { tool: 'r81e-device-owners', ts: new Date().toISOString(), mode: 'READ_ONLY' }
  out.subs = await get('/rest/v1/push_subscriptions?select=id,customer_id,driver_id,user_agent,last_success_at,failure_count,created_at&order=created_at.desc&limit=25')
  const custIds = [...new Set((Array.isArray(out.subs.j) ? out.subs.j : []).map((s) => s.customer_id).filter(Boolean))]
  out.customers_with_subs = await get(`/rest/v1/customers?id=in.(${custIds.join(',') || 'none'})&select=id,full_name,phone,email,user_id,created_at&limit=25`)
  const uids = (Array.isArray(out.customers_with_subs.j) ? out.customers_with_subs.j : []).map((c) => c.user_id).filter(Boolean)
  out.identities_of_them = uids.length
    ? await get(`/rest/v1/customer_channel_identities?customer_ref=in.(${uids.join(',')})&select=channel,external_user_id,customer_ref,created_at&limit=25`)
    : null

  fs.writeFileSync(path.join(__dirname, '_r81e_evidence.json'), JSON.stringify(out, null, 2))
  const rows = Array.isArray(out.customers_with_subs.j) ? out.customers_with_subs.j : []
  console.log('R81E customers_with_subs=' + rows.length)
  for (const c of rows) console.log('  · ' + c.id.slice(0, 8) + ' name=' + c.full_name + ' phone=' + (c.phone || '-') + ' email=' + (c.email || '-'))
  const subs = Array.isArray(out.subs.j) ? out.subs.j : []
  for (const s of subs) console.log('  SUB cust=' + String(s.customer_id || 'NULL').slice(0, 8) + ' driver=' + (s.driver_id || '-') + ' ua=' + String(s.user_agent || '').slice(0, 55) + ' ok=' + (s.last_success_at || '-'))
  const ids = out.identities_of_them && Array.isArray(out.identities_of_them.j) ? out.identities_of_them.j : []
  for (const i of ids) console.log('  IDENT ch=' + i.channel + ' ext=' + String(i.external_user_id).slice(0, 14) + '… cust=' + String(i.customer_ref).slice(0, 8))
}

main().catch((e) => { console.error('R81E_FAIL', String(e).slice(0, 300)); process.exit(1) })