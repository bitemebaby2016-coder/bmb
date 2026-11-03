// R65b — probe business_settings (hours/operating_hours/order_policy) + today's orders (read-only)
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')
const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
;(async () => {
  const out = { at: new Date().toISOString() }
  const s = await fetch(SB + '/rest/v1/business_settings?select=key,value&key=in.(hours,operating_hours,order_policy)', { headers: H })
  out.settingsStatus = s.status
  out.settings = await s.json().catch(() => null)
  const o = await fetch(SB + '/rest/v1/orders?select=order_number,delivery_method,status,order_mode,created_at,total_amount&created_at=gte.2026-11-03T00:00:00Z&order=created_at.desc&limit=30', { headers: H })
  out.ordersStatus = o.status
  out.orders = await o.json().catch(() => null)
  fs.writeFileSync(path.join(__dirname, 'r65bSettings-result.json'), JSON.stringify(out, null, 2))
  console.log('settings', out.settingsStatus, 'orders', out.ordersStatus, 'n=', Array.isArray(out.orders) ? out.orders.length : '?')
})().catch((e) => { console.error(e); process.exit(1) })
