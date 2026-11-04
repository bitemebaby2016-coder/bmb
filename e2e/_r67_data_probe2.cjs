'use strict'
// _r67_data_probe2 — discover real columns of menu_schedule + delivery_rounds (read-only)
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
    console.log(t.slice(0, 1200))
  } catch (e) {
    console.log('== ' + name + ' ERROR ' + String(e).slice(0, 200))
  }
}

;(async () => {
  const today = new Date().toISOString().slice(0, 10)
  await q('menu_schedule rows', '/rest/v1/menu_schedule?select=*&limit=5')
  await q('menu_schedule future', '/rest/v1/menu_schedule?select=*&scheduled_date=gte.' + today + '&limit=8')
  await q('delivery_rounds rows', '/rest/v1/delivery_rounds?select=*&limit=6')
  console.log('PROBE_DONE')
})()
