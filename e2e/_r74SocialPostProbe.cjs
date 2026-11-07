'use strict'
// R74-OMNI s7 — live probe: ทดสอบขาโพสต์ของ automation
//   ① social-post-worker = สร้าง draft จริง (เข้าคิว content_approvals pending · ไม่โพสต์เอง)
//   ② social-publish-worker action=poll_comments = AI ตอบคอมเมนต์อัตโนมัติ (idempotent)
//   auth ① = x-automation-token (AUTOMATION_TOKEN จาก Supabase secrets · ผ่าน mgmt key)
const fs = require('fs')
const path = require('path')
const { SB, SERVICE, S } = require('./wave2Lib.cjs')
const LOG = path.join(__dirname, '_r74_socialpost_live.log')
const out = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }
fs.writeFileSync(LOG, 'SOCIALPOST_START ' + new Date().toISOString() + '\n')
const REF = 'ivkdfognyiwjcmrhcnwz'
const toks = []
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*(bmb_PAT_SUPABASE_ACCESS_TOKEN|SUPABASE_ACCESS_TOKEN)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) toks.push(m[2])
}
;(async () => {
  // ดึง AUTOMATION_TOKEN (ไม่พิมพ์ค่า)
  let automationToken = ''
  for (const tok of [...toks].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
      headers: { Authorization: 'Bearer ' + tok },
    })
    if (!r.ok) continue
    const list = await r.json().catch(() => [])
    const hit = (list || []).find((s) => s.name === 'AUTOMATION_TOKEN')
    if (hit) { automationToken = hit.value; break }
  }
  out('AUTOMATION_TOKEN: ' + (automationToken ? 'มีความยาว ' + automationToken.length + ' (ไม่พิมพ์ค่า)' : 'ไม่พบ!'))
  if (!automationToken) return
  // ① draft — โจทย์เดียวกับที่ Owner กำลังทำค้างตอนเจอ ERR_FORBIDDEN
  //   (ลองคีย์จาก secrets store ก่อน แล้วค่อยคีย์ local — token เคยถูก rotate แล้ว instance เก่าอาจค้างค่า)
  const key = 'r74s7draft' + Date.now().toString(36)
  const localToken = S.AUTOMATION_TOKEN || ''
  let j1 = null
  let used = ''
  for (const [label, tok] of [['secrets-store', automationToken], ['local-file', localToken]]) {
    if (!tok) continue
    const r1 = await fetch(SB + '/functions/v1/social-post-worker', {
      method: 'POST',
      // platform verify_jwt ของฟังก์ชันนี้ต้องมี Authorization (คีย์) คู่กับ x-automation-token (EF gate)
      headers: { 'Content-Type': 'application/json', apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'x-automation-token': tok },
      body: JSON.stringify({ brief: 'แนะนำเมนูสุกี้แห้งหมู พร้อมน้ำซุปสตรอว์เบอร์รี ของร้าน Bite Me Baby (ทดสอบระบบ automation)', request_key: key }),
      signal: AbortSignal.timeout(120000),
    })
    j1 = await r1.json().catch(() => ({}))
    out('draft [' + label + '] HTTP ' + r1.status + ' → ' + JSON.stringify(j1).slice(0, 500))
    if (r1.status === 200 || r1.status === 201) { used = label; break }
    if (r1.status === 401 && j1 && j1.duplicate) break
  }
  out('token used: ' + (used || 'ไม่มีตัวไหนผ่าน'))
  // ② poll comments (AI ตอบคอมเมนต์อัตโนมัติ)
  const r2 = await fetch(SB + '/functions/v1/social-publish-worker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
    body: JSON.stringify({ action: 'poll_comments' }),
    signal: AbortSignal.timeout(90000),
  })
  const j2 = await r2.json().catch(() => ({}))
  out('poll_comments HTTP ' + r2.status + ' → ' + JSON.stringify(j2).slice(0, 400))
  out('SOCIALPOST_DONE')
})().catch((e) => { out('FATAL ' + String(e).slice(0, 400)); process.exit(1) })