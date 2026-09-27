// Wave 2 setup — provision test accounts + linked drivers (TEST DATA only)
'use strict'
const path = require('path')
const fs = require('fs')
const { api, SERVICE, ensureAuthUser, S, rpc, login } = require('./wave2Lib.cjs')
const fs = require('fs')

async function main() {
  const out = { timestamp: new Date().toISOString(), env: 'PRODUCTION-DB (test data only)', steps: [] }

  // 1) accounts
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  out.steps.push({ step: 'admin_login', status: admin.status, pass: admin.status === 200 })
  if (admin.status !== 200) throw new Error('admin login failed')

  const customer = await ensureAuthUser('qa-customer@bmb.co.th', 'BMB_TEST_CUSTOMER_PASSWORD')
  out.steps.push({ step: 'customer_account', uid: customer.uid, pass: !!customer.uid })

  const driver = await ensureAuthUser('qa-driver@bmb.co.th', 'BMB_TEST_DRIVER_PASSWORD')
  out.steps.push({ step: 'driver_account', uid: driver.uid, pass: !!driver.uid })

  const driverB = await ensureAuthUser('qa-driver2@bmb.co.th', 'BMB_TEST_DRIVER2_PASSWORD')
  out.steps.push({ step: 'driver_b_account', uid: driverB.uid, pass: !!driverB.uid })

  // 2) driver rows (service-key insert; idempotent by phone)
  const drvDefs = [
    { id: 'drv-qa-w2-01', phone: '0900000001', name: 'QA Rider A (W2)', user_id: driver.uid },
    { id: 'drv-qa-w2-02', phone: '0900000002', name: 'QA Rider B (W2)', user_id: driverB.uid },
  ]
  for (const d of drvDefs) {
    const q = await api(SERVICE, 'GET', '/rest/v1/drivers?id=eq.' + d.id)
    if (q.j?.length) {
      const up = await api(SERVICE, 'PATCH', '/rest/v1/drivers?id=eq.' + d.id, { user_id: d.user_id, name: d.name })
      out.steps.push({ step: 'driver_row_link', id: d.id, status: up.status, pass: up.status >= 200 && up.status < 300 })
    } else {
      const ins = await api(SERVICE, 'POST', '/rest/v1/drivers', { ...d, status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      out.steps.push({ step: 'driver_row_create', id: d.id, status: ins.status, pass: ins.status >= 200 && ins.status < 300 })
    }
  }

  // 3) verify identity link via JWT-bound driver_login (works only after migr 041)
  const dLogin = await login('qa-driver@bmb.co.th', driver.password)
  if (dLogin.status === 200) {
    const dl = await rpc(dLogin.jwt, 'driver_login')
    out.steps.push({ step: 'jwt_driver_login_probe', status: dl.status, body: dl.j ? JSON.stringify(dl.j).slice(0, 120) : null, note: '200 expected only after migr 041' })
  }

  // 4) test order (customer creates via canonical RPC; needs an active round + product)
  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status&limit=20')
  const active = (rounds.j || []).find((r) => r.status === 'active')
  const products = await api(SERVICE, 'GET', '/rest/v1/products?select=id,is_available&limit=50')
  const product = (products.j || []).find((p) => p.is_available !== false)
  if (!active || !product) {
    out.steps.push({ step: 'test_order', pass: false, note: 'no active round or available product found — create a round/product then re-run' })
  } else {
    const custLogin = await login('qa-customer@bmb.co.th', customer.password)
    if (custLogin.status !== 200) throw new Error('customer login failed')
    const created = await rpc(custLogin.jwt, 'create_order_with_items', {
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_delivery_round_id: active.id,
      p_delivery_method: 'self_delivery',
      p_delivery_address: 'TEST-ORDER address (Wave 2)',
      p_customer_name: 'W2 Test Customer',
      p_customer_phone: '0990000001',
      p_payment_method: 'promptpay_qr',
    })
    out.steps.push({ step: 'test_order_create', status: created.status, order: created.j?.order_number ?? null, pass: created.status === 200 })
    if (created.j?.order_number) fs.writeFileSync(path.join(__dirname, 'wave2-test-order.txt'), created.j.order_number)
  }

  fs.writeFileSync(require('path').join(process.cwd(), 'e2e', 'wave2-setup.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out.steps, null, 1))
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
