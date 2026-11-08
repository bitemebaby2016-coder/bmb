// ============================================
// BMB R81d — identity vs device linkage (READ-ONLY)
//   คำถาม: ลูกค้าที่ identity (FB) ชี้ = ลูกค้าคนเดียวกับที่มี subscription บนมือถือไหม?
//   - customers 5845e479 (จาก PSID) vs dddf4b57 (มี subscription 3 แถว)
//   - identity ของทั้งคู่ · subscription ทั้งหมด
//   evidence: e2e/_r81d_evidence.json
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
  const out = { tool: 'r81d-device-link', ts: new Date().toISOString(), mode: 'READ_ONLY' }
  const A = '5845e479-88ad-4616-a271-497c07f88794' // จาก PSID identity
  const B = 'dddf4b57-405f-4852-a985-76d8d52b1b72' // มี subscription บนมือถือ

  out.cust_A = await get(`/rest/v1/customers?id=eq.${A}&select=id,user_id,full_name,phone,email,created_at&limit=1`)
  out.cust_B = await get(`/rest/v1/customers?id=eq.${B}&select=id,user_id,full_name,phone,email,created_at&limit=1`)

  const uidA = out.cust_A.j?.[0]?.user_id
  const uidB = out.cust_B.j?.[0]?.user_id
  out.identity_A = uidA ? await get(`/rest/v1/customer_channel_identities?customer_ref=eq.${uidA}&select=channel,external_user_id,display_name,created_at&limit=10`) : null
  out.identity_B = uidB ? await get(`/rest/v1/customer_channel_identities?customer_ref=eq.${uidB}&select=channel,external_user_id,display_name,created_at&limit=10`) : null

  out.all_subscriptions = await get('/rest/v1/push_subscriptions?select=id,customer_id,driver_id,user_agent,last_success_at,last_failure_at,failure_count,created_at&order=created_at.desc&limit=20')
  out.all_identities_count = await get('/rest/v1/customer_channel_identities?select=id&limit=1')

  // auth user emails (internal ext- หรือบัญชีจริง) — auth.users อ่านผ่าน REST ไม่ได้โดยตรง ใช้ customers.email แทน
  out.customer_emails = await get('/rest/v1/customers?select=id,email,full_name,phone&order=created_at.desc&limit=30')

  fs.writeFileSync(path.join(__dirname, '_r81d_evidence.json'), JSON.stringify(out, null, 2))
  const brief = (x) => (Array.isArray(x.j) ? x.j : x.raw || x.status)
  console.log('R81D custA=' + JSON.stringify(brief(out.cust_A)).slice(0, 260))
  console.log('R81D custB=' + JSON.stringify(brief(out.cust_B)).slice(0, 260))
  console.log('R81D identA=' + JSON.stringify(brief(out.identity_A)).slice(0, 300))
  console.log('R81D identB=' + JSON.stringify(brief(out.identity_B)).slice(0, 300))
  console.log('R81D subs=' + JSON.stringify(brief(out.all_subscriptions)).slice(0, 700))
}

main().catch((e) => { console.error('R81D_FAIL', String(e).slice(0, 300)); process.exit(1) })