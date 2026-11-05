'use strict'
// _r69_pay_probe — READ-ONLY: ตรวจ payment record ของออเดอร์ทดสอบตัวที่ paid (BMB-20261104-995)
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', 'supabase', 'secrets.local.env')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }

const ORDER = process.argv[2] || 'BMB-20261104-995'

;(async () => {
  for (const t of ['payment_intents', 'payment_transactions', 'payments', 'refunds']) {
    try {
      const r = await fetch(`${BASE}/rest/v1/${t}?select=*&order_number=eq.${ORDER}&limit=5`, { headers: H })
      const tx = await r.text()
      console.log(`== ${t} ${r.status} ==`)
      console.log(tx.slice(0, 2000))
    } catch (e) {
      console.log(t + ' ERR ' + e.message)
    }
  }
  // ประวัติ audit ของออเดอร์
  const a = await fetch(`${BASE}/rest/v1/audit_logs?select=action,entity_id,description,metadata,created_at&entity_id=eq.${ORDER}&order=created_at.asc&limit=50`, { headers: H })
  console.log('== audit_logs ' + a.status + ' ==')
  console.log((await a.text()).slice(0, 3000))
})().catch(e => { console.error('ERR', e); process.exit(1) })