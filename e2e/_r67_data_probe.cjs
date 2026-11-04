'use strict'
// _r67_data_probe — READ-ONLY production data check for E2E matrix feasibility
// (menu_schedule future rows · delivery_rounds · available products · hours/master)
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

async function q(name, url) {
  try {
    const r = await fetch(BASE + url, { headers: H })
    const t = await r.text()
    console.log('== ' + name + ' status=' + r.status + ' ==')
    console.log(t.slice(0, 900))
  } catch (e) {
    console.log('== ' + name + ' ERROR ' + String(e).slice(0, 200))
  }
}

;(async () => {
  const today = new Date().toISOString().slice(0, 10)
  await q('products available', '/rest/v1/products?select=id,name,is_available,available_same_day,available_preorder,is_preorder&is_available=eq.true&limit=8')
  await q('menu_schedule future', '/rest/v1/menu_schedule?select=scheduled_date,product_id,status&scheduled_date=gte.' + today + '&limit=10')
  await q('delivery_rounds', '/rest/v1/delivery_rounds?select=id,name,round_period,status,cutoff_time,delivery_window_start,delivery_window_end&limit=10')
  await q('hours/master', "/rest/v1/business_settings?select=key,value&key=in.(hours,operating_hours,store_master_open,order_policy)")
  console.log('PROBE_DONE')
})()
