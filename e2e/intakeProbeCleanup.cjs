// Cleanup: cancel today's W3CEXT probe test orders via canonical cancel_order (D-02 hygiene)
'use strict'
const { S, login, rpc } = require('./wave2Lib.cjs')
const { api, SERVICE } = require('./wave2Lib.cjs')

;(async () => {
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200) throw new Error('test admin login failed: ' + admin.status)
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const r = await api(SERVICE, 'GET', `/rest/v1/orders?select=order_number,status,customer_name,created_at&customer_name=like.W3CEXT*&created_at=gte.${today}T00:00:00Z`)
  const rows = r.j || []
  console.log('found probe orders today:', rows.length)
  for (const o of rows) {
    if (o.status === 'cancelled') { console.log(o.order_number, 'already cancelled'); continue }
    const c = await rpc(admin.jwt, 'cancel_order', { p_order_number: o.order_number, p_reason: 'W3CEXT probe test order cleanup (D-02)' })
    console.log(o.order_number, '→', c.status, JSON.stringify(c.j && (c.j.message || c.j.code || 'ok')).slice(0, 80))
  }
  const after = await api(SERVICE, 'GET', `/rest/v1/orders?select=order_number&status=in.(pending,confirmed,ready_for_dispatch,dispatched)&created_at=gte.${today}T00:00:00Z`)
  console.log('remaining active today:', (after.j || []).length)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })