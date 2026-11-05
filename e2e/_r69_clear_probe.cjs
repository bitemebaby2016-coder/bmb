'use strict'
// _r69_clear_probe — READ-ONLY: หาออเดอร์ของบัญชีทดสอบ @bmb.test ที่ยังค้างใน production
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', 'supabase', 'secrets.local.env')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }

async function get(name, url) {
  const r = await fetch(BASE + url, { headers: H })
  const t = await r.text()
  console.log('== ' + name + ' status=' + r.status + ' ==')
  console.log(t.slice(0, 3000))
  try { return JSON.parse(t) } catch { return null }
}

;(async () => {
  // 1) auth users ที่มีอีเมลขึ้นต้นด้วย bmb.test
  let page = 1
  const users = []
  for (;;) {
    const r = await fetch(BASE + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: H })
    const j = await r.json()
    const list = j.users || []
    users.push(...list)
    if (list.length < 200) break
    page++
    if (page > 20) break
  }
  const targets = users.filter(u => (u.email || '').toLowerCase().includes('bmb.test'))
  console.log('== auth users total=' + users.length + ' bmb.test matches=' + targets.length + ' ==')
  for (const u of targets) console.log('  ' + u.id + ' | ' + u.email + ' | created=' + u.created_at)
  fs.writeFileSync(path.join(__dirname, '_r69_clear_users.json'), JSON.stringify(targets.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })), null, 2))

  const ids = targets.map(u => u.id)
  if (!ids.length) { console.log('NO_BMB_TEST_USERS'); return }

  // 2) ออเดอร์ทั้งหมดของบัญชีเหล่านี้
  const inList = '(' + ids.map(i => '"' + i + '"').join(',') + ')'
  const cols = 'id,order_number,status,payment_status,payment_method,order_mode,delivery_method,customer_id,customer_name,total_amount,created_at,updated_at,pickup_code'
  const orders = await get('orders of bmb.test', '/rest/v1/orders?select=' + cols + '&customer_id=in.' + encodeURIComponent(inList) + '&order=created_at.desc&limit=200')
  const list = Array.isArray(orders) ? orders : []
  const byStatus = {}
  for (const o of list) byStatus[o.status + '/' + o.payment_status] = (byStatus[o.status + '/' + o.payment_status] || 0) + 1
  console.log('== bmb.test orders total=' + list.length + ' ==')
  console.log(JSON.stringify(byStatus, null, 1))
  fs.writeFileSync(path.join(__dirname, '_r69_clear_orders.json'), JSON.stringify(list, null, 2))

  // A2) ออเดอร์ที่ยังไม่จบ (ทุกบัญชี) — ดูว่าตัวไหนค้าง/ผูกอยู่
  const open = await get('open orders (all customers)', '/rest/v1/orders?select=' + cols + '&status=not.in.(delivered,cancelled)&order=created_at.asc&limit=300')
  const openList = Array.isArray(open) ? open : []
  console.log('== open orders total=' + openList.length + ' ==')
  for (const o of openList) console.log('  ' + o.order_number + ' | ' + o.status + '/' + o.payment_status + ' | ' + o.order_mode + ' | ' + o.delivery_method + ' | ' + o.customer_name + ' | ' + o.created_at)
  fs.writeFileSync(path.join(__dirname, '_r69_open_orders.json'), JSON.stringify(openList, null, 2))

  // B) ออเดอร์จริงที่ค้างสลิป > 12 ชม. (payment ยังไม่ paid · ไม่ cancelled/refunded)
  const cutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  const stale = await get('stale unpaid >12h (all customers)', '/rest/v1/orders?select=' + cols + '&payment_status=neq.paid&status=not.in.(cancelled)&created_at=lt.' + cutoff + '&order=created_at.asc&limit=200')
  const staleList = Array.isArray(stale) ? stale : []
  console.log('== stale unpaid >12h total=' + staleList.length + ' ==')
  for (const o of staleList) console.log('  ' + o.order_number + ' | ' + o.status + '/' + o.payment_status + ' | ' + o.order_mode + ' | ' + o.payment_method + ' | ' + o.customer_name + ' | ' + o.created_at)
  fs.writeFileSync(path.join(__dirname, '_r69_stale_orders.json'), JSON.stringify(staleList, null, 2))
  console.log('PROBE_DONE')
})().catch(e => { console.error('ERR', e); process.exit(1) })