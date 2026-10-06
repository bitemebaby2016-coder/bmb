// ============================================
// g9PublishJourney — REAL production publish journey (Owner-approved 2026-10-06)
//   node e2e/g9PublishJourney.cjs
//
// Proves the full G9 publish chain on production, twice (PRE_ORDER + SAME_DAY):
//   content_approvals (approved) → social-publish-worker → Graph /feed
//   → audit_logs id='g9-publish-<approval_id>'
//   → REPLAY of the same approvalId returns already:true (never posts twice)
//
// Writes 2 approved rows + publishes 2 REAL posts to the live Page.
// The rows are audit evidence (review_note='PUBLISHED <post_id>').
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const SERVICE = (() => {
  const raw = fs.readFileSync(path.join(ROOT, 'supabase', 'secrets.local.env'), 'utf8')
  const m = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)
  return m ? m[1].trim() : ''
})()

const SB = env.VITE_SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const WORKER = SB + '/functions/v1/social-publish-worker'

const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' }

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

// The two journey posts (Owner asked: 1 PRE_ORDER + 1 SAME_DAY real publish)
const JOURNEY = [
  {
    id: 'g9-journey-preorder-001',
    title: '[G9 Acceptance] เปิดรับ Pre-Order ล่วงหน้า',
    body:
      'เมนูพิเศษสั่งจองล่วงหน้า 1 วัน รับตรงเวลาที่นัดหมาย 🍔\n' +
      'กดสั่งล่วงหน้าได้แล้วผ่านแอป Bite Me Baby — ที่นั่ง/เดลิเวอรีรับออเดอร์ตรงเวลา ไม่ต้องรอคิวนาน\n' +
      '#PreOrder #BiteMeBaby',
  },
  {
    id: 'g9-journey-sameday-001',
    title: '[G9 Acceptance] สั่งวันนี้ ส่งวันนี้',
    body:
      'Same-Day Delivery — สั่งวันนี้ได้กินวันนี้ ภายใน 60 นาที 🛵\n' +
      'แพ็กแน่น ร้อนถึงมือ คิดค่าส่งตามระยะทางจริง ตรวจสอบได้ทุกออเดอร์ในแอป\n' +
      '#SameDay #BiteMeBaby',
  },
]

async function ensureApproved(row) {
  // idempotent insert: if the row exists, keep it (it may already be published)
  const get = await fetch(`${SB}/rest/v1/content_approvals?id=eq.${encodeURIComponent(row.id)}&select=id,status`, { headers: H })
  const existing = await get.json().catch(() => [])
  if (Array.isArray(existing) && existing.length > 0) return row.id
  const res = await fetch(`${SB}/rest/v1/content_approvals`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({
      id: row.id,
      content_type: 'post',
      title: row.title,
      body: row.body,
      status: 'approved',
      review_note: 'G9 journey — Owner-approved real publish 2026-10-06',
      reviewed_at: new Date().toISOString(),
    }),
  })
  if (res.status !== 201) throw new Error('insert failed HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200))
  return row.id
}

async function invokeWorker(approvalId) {
  const r = await fetch(WORKER, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalId }),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: r.status, json, text }
}

async function main() {
  console.log('--- G9 publish journey (REAL production posts) ---')
  if (!SERVICE) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from supabase/secrets.local.env')
  if (!env.META_PAGE_ACCESS_TOKEN) throw new Error('META_PAGE_ACCESS_TOKEN missing from .env.local')

  const evidence = []
  for (const row of JOURNEY) {
    console.log(`\n== ${row.id} ==`)
    await ensureApproved(row)

    // 1) fresh publish
    const pub = await invokeWorker(row.id)
    const postId = pub.json?.meta?.post_id || ''
    check(`${row.id} publish → 200 + post_id`,
      pub.status === 200 && pub.json?.ok === true && !!postId && pub.json?.already !== true,
      `HTTP ${pub.status} post_id=${postId || JSON.stringify(pub.json).slice(0, 120)}`)

    // 2) replay must be idempotent
    const replay = await invokeWorker(row.id)
    check(`${row.id} replay → already:true (no second post)`,
      replay.status === 200 && replay.json?.ok === true && replay.json?.already === true &&
      replay.json?.meta?.post_id === postId,
      `HTTP ${replay.status} already=${replay.json?.already} post_id=${replay.json?.meta?.post_id || ''}`)

    // 3) audit row exists (deterministic PK)
    const audit = await fetch(`${SB}/rest/v1/audit_logs?id=eq.g9-publish-${encodeURIComponent(row.id)}&select=id,action,metadata`, { headers: H })
    const auditRows = await audit.json().catch(() => [])
    check(`${row.id} audit_logs g9-publish-* recorded`,
      Array.isArray(auditRows) && auditRows.length === 1 && auditRows[0].action === 'social.publish',
      auditRows?.[0]?.metadata?.post_id ? `post_id=${auditRows[0].metadata.post_id}` : JSON.stringify(auditRows).slice(0, 120))

    evidence.push({ approval_id: row.id, post_id: postId, replay_already: replay.json?.already === true, audit: auditRows?.[0]?.id || null })
  }

  fs.writeFileSync(path.join(ROOT, 'e2e', 'g9-publish-journey-evidence.json'),
    JSON.stringify({ ran_at: new Date().toISOString(), page_id: env.META_PAGE_ID, evidence }, null, 2))
  console.log('\nEVIDENCE_WRITTEN e2e/g9-publish-journey-evidence.json')
  console.log(`--- G9_JOURNEY_RESULT: ${pass} pass / ${fail} fail ---`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('G9_JOURNEY_ERROR: ' + e.message); process.exit(1) })
