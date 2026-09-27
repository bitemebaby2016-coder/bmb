// ============================================
// BMB Identity Foundation — production probe (TEST DATA ONLY)
// Evidence: e2e/identity-foundation-e2e.json
// Usage: node e2e/identityFoundationProbe.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, ANON, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

const uidFromJwt = (jwt) => {
  try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8')).sub } catch { return null }
}

;(async () => {
  const out = { date: new Date().toISOString(), tests: [] }
  const t = (name, pass, detail) => out.tests.push({ name, pass, detail })
  const ts = Date.now()
  const EXT = 'f14-id-' + ts

  const cust = await login('qa-customer@bmb.co.th', S.BMB_TEST_CUSTOMER_PASSWORD)
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  const driver = await login('qa-driver@bmb.co.th', S.BMB_TEST_DRIVER_PASSWORD)
  const custUid = uidFromJwt(cust.jwt)
  const driverUid = uidFromJwt(driver.jwt)
  t('logins', cust.status === 200 && admin.status === 200 && driver.status === 200 && !!custUid && !!driverUid,
    'cust=' + cust.status + ' admin=' + admin.status + ' driver=' + driver.status)

  // 1. NO SELF-LINKING: customer cannot link arbitrary external identity
  const selfLink = await rpc(cust.jwt, 'link_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT, p_customer_ref: custUid })
  t('customer-self-link-denied', selfLink.status === 400 && JSON.stringify(selfLink.j).includes('ERR_ONLY_ADMIN'),
    'status=' + selfLink.status + ' body=' + JSON.stringify(selfLink.j).slice(0, 100))

  // 2. driver link denied
  const drvLink = await rpc(driver.jwt, 'link_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT, p_customer_ref: driverUid })
  t('driver-link-denied', drvLink.status === 400 && JSON.stringify(drvLink.j).includes('ERR_ONLY_ADMIN'), 'status=' + drvLink.status)

  // 3. admin link (canonical flow) → created
  const link1 = await rpc(admin.jwt, 'link_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT, p_customer_ref: custUid, p_display_name: 'F14 Test FB User' })
  const id1 = link1.j && link1.j.id
  t('admin-link-created', link1.status === 200 && link1.j.duplicate === false && link1.j.collision === false && !!id1,
    'status=' + link1.status + ' id=' + id1)

  // 4. duplicate link (same channel + same external id) → ONE identity
  const link2 = await rpc(admin.jwt, 'link_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT, p_customer_ref: custUid })
  t('duplicate-link-same-identity', link2.status === 200 && link2.j.duplicate === true && link2.j.id === id1, 'id=' + (link2.j && link2.j.id))

  // 5. same external ID + different channel → separate identity (no auto cross-channel equality)
  const linkMesg = await rpc(admin.jwt, 'link_channel_identity', { p_channel: 'MESSENGER', p_external_user_id: EXT, p_customer_ref: custUid })
  t('cross-channel-separate-identity', linkMesg.status === 200 && linkMesg.j.duplicate === false && linkMesg.j.id !== id1,
    'msg_id=' + (linkMesg.j && linkMesg.j.id))

  // 6. same channel + different external ID → separate identity
  const linkOther = await rpc(admin.jwt, 'link_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT + '-b', p_customer_ref: custUid })
  t('different-extid-separate', linkOther.status === 200 && linkOther.j.duplicate === false, 'id=' + (linkOther.j && linkOther.j.id))

  // 7. identity collision (same channel+ext, different customer) → rejected, owner unchanged
  const collision = await rpc(admin.jwt, 'link_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT, p_customer_ref: driverUid })
  t('identity-collision-rejected', collision.status === 200 && collision.j.collision === true && collision.j.customer_ref === custUid,
    'collision=' + (collision.j && collision.j.collision) + ' owner=' + (collision.j && collision.j.customer_ref))

  // 8. RLS: admin sees; customer/driver/anon see nothing
  const adminJwtView = await api(ANON, 'GET', '/rest/v1/customer_channel_identities?select=id&limit=5', undefined, admin.jwt)
  const custView = await api(ANON, 'GET', '/rest/v1/customer_channel_identities?select=id&limit=5', undefined, cust.jwt)
  const drvView = await api(ANON, 'GET', '/rest/v1/customer_channel_identities?select=id&limit=5', undefined, driver.jwt)
  const anonView = await api(ANON, 'GET', '/rest/v1/customer_channel_identities?select=id&limit=5')
  t('admin-can-read', adminJwtView.status === 200 && (adminJwtView.j || []).length > 0, 'rows=' + (adminJwtView.j || []).length)
  t('customer-cannot-read', custView.status !== 200 || (custView.j || []).length === 0, 'status=' + custView.status + ' rows=' + (custView.j || []).length)
  t('driver-cannot-read', drvView.status !== 200 || (drvView.j || []).length === 0, 'status=' + drvView.status + ' rows=' + (drvView.j || []).length)
  t('anon-cannot-read', anonView.status !== 200 || (anonView.j || []).length === 0, 'status=' + anonView.status + ' rows=' + (anonView.j || []).length)

  // 9. direct table INSERT by customer → denied (REVOKE)
  const direct = await api(ANON, 'POST', '/rest/v1/customer_channel_identities', { channel: 'FACEBOOK', external_user_id: EXT + '-direct', customer_ref: custUid }, cust.jwt)
  t('direct-table-insert-denied', direct.status === 401 || direct.status === 403 || direct.status === 404, 'status=' + direct.status)

  // 10. resolve via service_role (trusted adapter path) + anon resolve denied
  const resolveSvc = await api(SERVICE, 'POST', '/rest/v1/rpc/resolve_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT })
  const resolveOk = resolveSvc.status === 200 && resolveSvc.j.linked === true && resolveSvc.j.customer_ref === custUid
  const resolveAnon = await api(ANON, 'POST', '/rest/v1/rpc/resolve_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT })
  t('resolve-via-service-role', resolveOk, 'status=' + resolveSvc.status + ' body=' + JSON.stringify(resolveSvc.j).slice(0, 120))
  t('resolve-anon-denied', resolveAnon.status === 401 || resolveAnon.status === 403 || resolveAnon.status === 404, 'status=' + resolveAnon.status)

  // 11. unlink → gone; relink after unlink → new row (explicit admin op)
  const unlink = await rpc(admin.jwt, 'unlink_channel_identity', { p_id: id1 })
  const afterUnlink = await api(SERVICE, 'GET', `/rest/v1/customer_channel_identities?id=eq.${id1}&select=id`)
  t('unlink-removes-identity', unlink.status === 200 && unlink.j.unlinked === true && (afterUnlink.j || []).length === 0,
    'unlinked=' + (unlink.j && unlink.j.unlinked) + ' rows=' + (afterUnlink.j || []).length)
  const relink = await rpc(admin.jwt, 'link_channel_identity', { p_channel: 'FACEBOOK', p_external_user_id: EXT, p_customer_ref: custUid })
  t('relink-after-unlink', relink.status === 200 && relink.j.duplicate === false && relink.j.id !== id1, 'new_id=' + (relink.j && relink.j.id))

  // 12. concurrent identity creation (parallel same channel+ext, DIFFERENT customers) → ONE row + collision
  const cref = 'f14-conc-id-' + ts
  const [c1, c2] = await Promise.all([
    rpc(admin.jwt, 'link_channel_identity', { p_channel: 'LINE', p_external_user_id: cref, p_customer_ref: custUid }),
    rpc(admin.jwt, 'link_channel_identity', { p_channel: 'LINE', p_external_user_id: cref, p_customer_ref: driverUid }),
  ])
  const ccnt = await api(SERVICE, 'GET', `/rest/v1/customer_channel_identities?channel=eq.LINE&external_user_id=eq.${cref}&select=id`)
  t('concurrent-identity-one-row', c1.status === 200 && c2.status === 200 && (c1.j.collision === true || c2.j.collision === true) && (ccnt.j || []).length === 1,
    'rows=' + (ccnt.j || []).length + ' c1_collision=' + (c1.j && c1.j.collision) + ' c2_collision=' + (c2.j && c2.j.collision))

  // 13. audit trail: identity mutations recorded
  const audit = await api(SERVICE, 'GET', '/rest/v1/audit_logs?action=in.(identity_linked,identity_unlinked,identity_link_rejected,identity_link_duplicate)&select=action&limit=50')
  const actions = new Set((audit.j || []).map((x) => x.action))
  t('audit-trail-recorded', actions.has('identity_linked') && actions.has('identity_unlinked') && actions.has('identity_link_rejected'),
    'actions=' + [...actions].join(','))

  out.pass = out.tests.every((x) => x.pass)
  out.pass_count = out.tests.filter((x) => x.pass).length
  out.total = out.tests.length
  fs.writeFileSync(path.join(__dirname, 'identity-foundation-e2e.json'), JSON.stringify(out, null, 2))
  console.log(out.pass ? 'IDENTITY PROBE: PASS ' + out.pass_count + '/' + out.total : 'IDENTITY PROBE: ' + out.pass_count + '/' + out.total + ' (see FAILs)')
  for (const x of out.tests) console.log((x.pass ? '  PASS ' : '  FAIL ') + x.name + ' — ' + x.detail)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })

