'use strict'
// ============================================
// STEP 2 — Deploy ONLY the 3 STEP 2 fixed Edge Functions to prod project
// Owner-authorized 2026-09-28 (TEST mode only). No migration/schema/data.
// v2: manual multipart FormData (Node's FormData drops filename header).
// Evidence: e2e/step2-deploy-evidence.json
// ============================================
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(PROJ, 'e2e', 'step2-deploy-evidence.json')

const FUNCS = [
  { name: 'create-checkout', verify_jwt: true,  file: 'supabase/functions/create-checkout/index.ts' },
  { name: 'stripe-webhook',   verify_jwt: false, file: 'supabase/functions/stripe-webhook/index.ts' },
  { name: 'stripe-refund',    verify_jwt: true,  file: 'supabase/functions/stripe-refund/index.ts' },
]

// Manual multipart body so the filename attribute is guaranteed in Content-Disposition.
function buildMultipart(parts) {
  const boundary = '----bmb' + crypto.randomBytes(16).toString('hex')
  const enc = new TextEncoder()
  const chunks = []
  const push = (s) => chunks.push(typeof s === 'string' ? enc.encode(s) : s)
  for (const p of parts) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"`)
    if (p.filename) push(`; filename="${p.filename}"`)
    push(`\r\nContent-Type: ${p.type || 'application/octet-stream'}\r\n\r\n`)
    push(p.value)
    push(`\r\n`)
  }
  push(`--${boundary}--\r\n`)
  const total = chunks.reduce((a, b) => a + b.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return { boundary, body: out }
}

async function deployOne(f) {
  const abs = path.join(PROJ, f.file)
  const src = fs.readFileSync(abs, 'utf8')
  const sha = crypto.createHash('sha256').update(src).digest('hex')
  const metadata = JSON.stringify({ entrypoint_path: f.file, name: f.name, verify_jwt: f.verify_jwt })
  const { boundary, body } = buildMultipart([
    { name: 'metadata', value: metadata, type: 'application/json' },
    { name: 'files', filename: f.file, value: src, type: 'text/typescript' },
  ])
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${f.name}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: body,
  })
  const bodyText = await r.text()
  let resp = null; try { resp = JSON.parse(bodyText) } catch { resp = bodyText.slice(0, 300) }
  // After deploy, query details for new version + ezbr hash
  let detail = null
  try {
    const rd = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/${f.name}`, { headers: { Authorization: 'Bearer ' + TOKEN } })
    detail = await rd.json()
  } catch (e) { detail = { error: String(e).slice(0, 120) } }
  return { name: f.name, verify_jwt: f.verify_jwt, deploy_status: r.status, deploy_body: resp, sha256: sha, detail: { version: detail.version, ezbr_sha256: detail.ezbr_sha256, entrypoint_path: detail.entrypoint_path, verify_jwt: detail.verify_jwt, detail_status: detail.status || undefined } }
}

async function main() {
  const ev = { step: 'STEP2 EF DEPLOY', timestamp: new Date().toISOString(), project: REF, owner_auth: 'deploy-3-fix-efs-test-only', funcs: {}, note: 'NO migration / NO schema change / NO data mutation / NO secret printed' }
  for (const f of FUNCS) {
    try { ev.funcs[f.name] = await deployOne(f) }
    catch (e) { ev.funcs[f.name] = { name: f.name, error: String(e).slice(0, 200) } }
  }
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  for (const [k, v] of Object.entries(ev.funcs)) {
    console.log(`FUNC ${k} deploy_status=${v.deploy_status} error=${v.error || 'none'} newVersion=${v.detail && v.detail.version}`)
    console.log(`     sha256=${v.sha256} ezbr=${v.detail && v.detail.ezbr_sha256}`)
  }
  console.log('EVIDENCE -> ' + OUT)
}
main().catch((e) => { console.error('FATAL', String(e).slice(0, 500)); process.exit(1) })