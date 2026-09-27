const { ANON, rpc, login, readSecrets, api } = require('../e2e/wave2Lib.cjs')
;(async () => {
  const a = await login(readSecrets().BMB_TEST_ADMIN_EMAIL, readSecrets().BMB_TEST_ADMIN_PASSWORD)
  const q = await api(ANON, 'GET', '/rest/v1/orders?customer_ref=eq.5c609eb9-0943-4e40-b1ee-c450dca9c594&select=order_number,status&order=created_at.desc&limit=5', undefined, a.jwt)
  const p = (q.j || []).find((o) => o.status === 'pending')
  console.log('new_pending', p ? p.order_number : 'none')
  if (p) {
    const t = await rpc(a.jwt, 'transition_order_status', { p_order_number: p.order_number, p_new_status: 'confirmed' })
    console.log('confirm', t.status, JSON.stringify(t.j || {}).slice(0, 80))
  }
})()