'use strict'
// _r69_clear_run2 — round 2: ปิด 2 ออเดอร์ทดสอบ PRE_ORDER ที่ cancel ไม่ได้ (ERR_CANCEL_AFTER_CUTOFF)
// ตามคำสั่ง Owner (2026-11-05): "ตั้งสถานะเป็น failed และแยกหมวดหมู่จัดเก็บให้เหมาะสม"
//   · failed = state machine แอดมินอนุญาต (pending→failed · 127 line 174) · ไม่แตะกติกา cutoff 038
//   · แยกหมวดหมู่ = audit_logs row หมวด test_data (batch R69) + สรุปใน _r69_clear_result.json
const { S, login, rpc, api, SERVICE } = require('./wave2Lib.cjs')

const TARGETS = ['PO-20261105-931', 'PO-20261105-685']

;(async () => {
  const out = { at: new Date().toISOString(), steps: [], failed_marked: [], audit: [], failed: [] }

  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200) throw new Error('test admin login failed: ' + admin.status)
  out.steps.push({ step: 'admin_login', status: admin.status })

  for (const orderNumber of TARGETS) {
    // 1) pending → failed (allowed transition · capacity release ผ่าน terminal trigger เหมือน cancel)
    const t = await rpc(admin.jwt, 'transition_order_status', {
      p_order_number: orderNumber,
      p_new_status: 'failed',
    })
    const ok = t.status === 200 && t.j && (t.j.ok !== false) && t.j.to === 'failed'
    console.log(`failed ${orderNumber} → http ${t.status} ${JSON.stringify(t.j).slice(0, 200)}`)
    if (!ok) { out.failed.push({ order_number: orderNumber, phase: 'transition', http: t.status, resp: t.j }); continue }
    // นับทุกตัวที่สถานะเป็น failed (รวม replay) — ห้ามรายงานว่างเมื่อของจริงมี
    out.failed_marked.push({ order_number: orderNumber, http: t.status, from: t.j.from, idempotent: t.j.from === 'failed' })
    if (t.j.from === 'failed') console.log(`  (already failed from previous run — idempotent)`)

    // 2) แยกหมวดหมู่จัดเก็บ: audit row หมวด test_data (batch R69) มองเห็นจากหน้า inspect แอดมิน
    //    (id = PK → insert ซ้ำได้รับ 409 = มีอยู่แล้ว = idempotent)
    const a = await api(SERVICE, 'POST', '/rest/v1/audit_logs', {
      id: 'alog-r69-fail-' + orderNumber,
      action: 'test_data_cleanup',
      entity_type: 'order',
      entity_id: orderNumber,
      description: 'R69 test-data cleanup: unpaid PRE_ORDER past cancel-cutoff → failed (Owner decision 2026-11-05)',
      metadata: {
        category: 'test_data',
        batch: 'R69',
        reason: 'ERR_CANCEL_AFTER_CUTOFF — cancel ถูกกติกา 038 Q2/A ห้ามทุกบทบาท → Owner สั่ง failed',
        from_status: 'pending',
        payment_status: 'pending',
        order_mode: 'PRE_ORDER',
      },
    })
    const aOk = a.status === 201 || a.status === 200 || a.status === 409
    console.log(`audit ${orderNumber} → http ${a.status}${aOk ? ' (ok)' : ' ' + JSON.stringify(a.j).slice(0, 300)}`)
    if (aOk) out.audit.push({ order_number: orderNumber, http: a.status })
    else out.failed.push({ order_number: orderNumber, phase: 'audit', http: a.status, resp: a.j })
  }

  // 3) VERIFY: ไม่เหลือ bmb.test เปิดอยู่
  const v = await api(SERVICE, 'GET',
    '/rest/v1/orders?select=order_number,status,payment_status,customer_name' +
    '&status=not.in.(delivered,cancelled,failed)&limit=500')
  const still = (v.j || []).filter(o => String(o.customer_name || '').toLowerCase().includes('@bmb.test'))
  out.remaining_open = still

  // 3b) POSITIVE evidence (ห้ามพิสูจน์แต่ "ไม่เหลือ" ต้องเห็นของจริงด้วย):
  //     สถานะ 2 เป้า = failed จริง + audit row หมวด test_data มีจริง 2 แถว
  const inList = encodeURIComponent('("PO-20261105-931","PO-20261105-685")')
  const t3 = await api(SERVICE, 'GET', `/rest/v1/orders?select=order_number,status,payment_status&order_number=in.${inList}`)
  const targets = t3.j || []
  const a3 = await api(SERVICE, 'GET', `/rest/v1/audit_logs?select=id,action,entity_id,metadata&id=in.${inList.replace(/PO-/g, 'alog-r69-fail-PO-')}`)
  const auditRows = a3.j || []
  out.targets_state = targets
  out.audit_rows = auditRows
  const positiveOk =
    targets.length === 2 &&
    targets.every(o => o.status === 'failed') &&
    auditRows.length === 2 &&
    auditRows.every(r => r.action === 'test_data_cleanup')
  out.verified = still.length === 0 && out.failed.length === 0 && positiveOk
  console.log('targets =', JSON.stringify(targets.map(o => o.order_number + ':' + o.status)))
  console.log('audit_rows =', auditRows.length, auditRows.map(r => r.id).join(' | '))
  console.log('remaining open bmb.test =', still.length, '· errors =', out.failed.length, '· VERIFIED =', out.verified)

  // 4) รวมผลกับรอบ 1 (แยกหมวดหมู่จัดเก็บตามคำสั่ง Owner)
  const fs = require('fs')
  const path = require('path')
  const prevPath = path.join(__dirname, '_r69_clear_result.json')
  const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'))
  // ผล round1 ที่เคย failed (2 PO ยกเลิกไม่ได้) = resolve แล้วใน round2 — เก็บเป็นประวัติ ไม่นับเป็น error ค้าง
  prev.round1_errors = prev.failed
  prev.failed = []
  prev.round2 = out
  prev.categories = {
    cancelled: (prev.cancelled || []).map(c => c.order_number),
    delivered: (prev.delivered || []).map(c => c.order_number),
    failed_test_data: out.failed_marked.map(c => c.order_number),
    skipped: (prev.skipped || []).map(o => o.order_number),
    errors: out.failed.map(c => `${c.order_number}${c.phase ? ':' + c.phase : ''}`),
  }
  prev.verified = out.verified
  fs.writeFileSync(prevPath, JSON.stringify(prev, null, 2))
  console.log('CATEGORIES', JSON.stringify(prev.categories))
  console.log('CLEAR2_DONE verified=' + prev.verified)
  if (!prev.verified) process.exit(2)
})().catch(e => { console.error('ERR', e); process.exit(1) })