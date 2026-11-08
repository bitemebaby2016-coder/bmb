// ============================================
// BMB R82 — ops: ผูก identity Facebook ของลูกค้าให้ชี้ไปบัญชีที่มีเครื่องสมัคร push
//   (production write — ห้ามรันโดยไม่ได้รับอนุมัติจาก Owner)
//
// WHY (evidence _r81c/_r81d/_r81e): คอมเมนต์จาก PSID 28680684258210089 → identity ชี้
//   บัญชี ext-…@channels.bmb.internal (auto-provision) = ไม่มี push_subscriptions เลย
//   → web push ถึงเครื่องลูกค้าไม่ได้แม้แก้ eq. แล้ว (outcome = no_subscription)
//   อุปกรณ์ที่สมัคร push อยู่จริง = บัญชีอื่น (Siam Portal Customer / Self Print / ADMIN_BMB)
//   → ต้อง unlink identity เดิมแล้ว link ใหม่ไปบัญชีที่ "เครื่องที่ใช้ทดสอบ" log in อยู่
//
// RPC (m046 · admin-only + audit): unlink_channel_identity(p_id) → link_channel_identity(...)
// Usage:
//   node e2e/_r82LinkIdentity.cjs <customers.id ปลายทาง>           → DRY RUN (พิมพ์แผนอย่างเดียว)
//   node e2e/_r82LinkIdentity.cjs <customers.id> --fire            → ลงจริง + verify
//   PSID เปลี่ยนได้ด้วย env PSID=... (ค่าเริ่ม = PSID ของ Owner ตาม evidence)
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB, ANON, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

const PSID = process.env.PSID || '28680684258210089'
const TARGET_CUSTOMER = process.argv[2] || ''
const FIRE = process.argv.includes('--fire')
const LOG = path.join(__dirname, '_r82_link_identity.log')
const out = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }

async function main() {
  out('R82_LINK_START ' + new Date().toISOString() + ' fire=' + FIRE)
  if (!TARGET_CUSTOMER) {
    console.error('ต้องระบุ customers.id ปลายทาง: node e2e/_r82LinkIdentity.cjs <customers.id> [--fire]')
    process.exit(1)
  }

  // 1) identity ปัจจุบันของ PSID
  const cur = await api(SERVICE, 'GET',
    `/rest/v1/customer_channel_identities?external_user_id=eq.${PSID}&channel=eq.FACEBOOK&select=id,customer_ref,display_name&limit=3`)
  const row = Array.isArray(cur.j) ? cur.j[0] : null
  if (!row) { out('FAIL: identity not found for PSID ' + PSID); process.exit(1) }
  out('current identity id=' + row.id + ' customer_ref=' + row.customer_ref)

  // 2) ปลายทาง: customers → user_id (customer_ref = auth.users.id)
  const tgt = await api(SERVICE, 'GET', `/rest/v1/customers?id=eq.${TARGET_CUSTOMER}&select=id,user_id,full_name,email,phone&limit=1`)
  const cust = Array.isArray(tgt.j) ? tgt.j[0] : null
  if (!cust || !cust.user_id) { out('FAIL: target customer not found / no user_id'); process.exit(1) }
  out('target customer=' + cust.id + ' name=' + cust.full_name + ' email=' + (cust.email || '-') + ' uid=' + cust.user_id)

  // 3) เครื่องของปลายทางมี subscription ไหม (จุดประสงค์ทั้งหมดของการผูก)
  const subs = await api(SERVICE, 'GET', `/rest/v1/push_subscriptions?customer_id=eq.${cust.id}&select=id,user_agent,last_success_at&limit=10`)
  const subRows = Array.isArray(subs.j) ? subs.j : []
  out('target subscriptions=' + subRows.length + (subRows.length ? ' (ล่าสุดสำเร็จ ' + (subRows[0].last_success_at || '-') + ')' : ' ⚠️ ไม่มีเครื่องรับได้ — ผูกไปก็ไม่ดัง'))
  if (subRows.length === 0) {
    out('ABORT: ปลายทางไม่มี push subscription — เลือกบัญชีที่เครื่อง log in อยู่ก่อน (ดู _r81e_evidence.json)')
    process.exit(2)
  }

  if (!FIRE) {
    out('DRY RUN — ไม่ได้แก้ไขอะไร (แนบ --fire เพื่อดำเนินการ)')
    out('แผน: unlink_channel_identity(' + row.id + ') → link_channel_identity(FACEBOOK, ' + PSID + ', ' + cust.user_id + ') → verify')
    return
  }

  // 4) fire: admin login → unlink → link → verify
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200 || !admin.jwt) { out('FAIL: admin login ' + admin.status + ' ' + (admin.error || '')); process.exit(1) }

  const un = await rpc(admin.jwt, 'unlink_channel_identity', { p_id: row.id })
  out('unlink status=' + un.status + ' ' + JSON.stringify(un.j).slice(0, 200))
  if (un.status !== 200 || un.j?.ok === false) { out('FAIL: unlink'); process.exit(1) }

  const lk = await rpc(admin.jwt, 'link_channel_identity', {
    p_channel: 'FACEBOOK',
    p_external_user_id: PSID,
    p_customer_ref: cust.user_id,
    p_display_name: 'Owner test device',
  })
  out('link status=' + lk.status + ' ' + JSON.stringify(lk.j).slice(0, 240))
  if (lk.status !== 200 || lk.j?.ok === false) { out('FAIL: link (check is_admin / collision)'); process.exit(1) }

  const verify = await api(SERVICE, 'GET',
    `/rest/v1/customer_channel_identities?external_user_id=eq.${PSID}&select=customer_ref,channel&limit=3`)
  out('verify = ' + JSON.stringify(verify.j))
  out('R82_LINK_DONE ' + new Date().toISOString())
}

main().catch((e) => { out('R82_LINK_ERROR ' + String(e).slice(0, 300)); process.exit(1) })