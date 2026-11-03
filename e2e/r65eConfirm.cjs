// R65e — confirm: orders today (any window) + cart session detail + payment_intents today (read-only)
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')
const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
const get = async (q) => {
  const r = await fetch(SB + q, { headers: H })
  return { s: r.status, j: await r.json().catch(() => null) }
}
;(async () => {
  const out = { at: new Date().toISOString() }
  out.ordersAll = await get('/rest/v1/orders?select=order_number,delivery_method,status,created_at&order=created_at.desc&limit=5')
  out.ordersToday = await get("/rest/v1/orders?select=order_number,delivery_method,status,created_at&created_at=gte.2026-11-03T00:00:00.000Z&order=created_at.desc&limit=10")
  out.pi = await get('/rest/v1/payment_intents?select=order_number,status,created_at&created_at=gte.2026-11-03T00:00:00.000Z&order=created_at.desc&limit=10')
  out.cartOne = await get('/rest/v1/cart_sessions?select=*&id=eq.csx-mw0b15l6-zyzag1')
  fs.writeFileSync(path.join(__dirname, 'r65eConfirm-result.json'), JSON.stringify(out, null, 2))
  console.log('ordersAll', out.ordersAll.s, Array.isArray(out.ordersAll.j) ? out.ordersAll.j.length : '?',
    '| ordersToday', out.ordersToday.s, Array.isArray(out.ordersToday.j) ? out.ordersToday.j.length : '?',
    '| pi', out.pi.s, Array.isArray(out.pi.j) ? out.pi.j.length : '?',
    '| cart', out.cartOne.s)
  if (Array.isArray(out.ordersAll.j) && out.ordersAll.j[0]) console.log('latest order:', JSON.stringify(out.ordersAll.j[0]))
})().catch((e) => { console.error(e); process.exit(1) })
