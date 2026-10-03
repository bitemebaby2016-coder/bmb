// G7-S4-C v5 — multipart deploy: field "file" + repo-relative filenames + matching entrypoint (step2 pattern)
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || fs.readFileSync(path.join(PROJ, '.env.local'), 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim()
const REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(PROJ, 'e2e', 'g7s4-deploy-evidence.json')
const EP = 'supabase/functions/social-post-worker/index.ts'
const FILES = [
  'supabase/functions/social-post-worker/index.ts',
  'supabase/functions/_shared/aiPolicy.ts',
  'supabase/functions/_shared/aiTimeout.ts',
  'supabase/functions/_shared/aiStructuredOutput.ts',
]
function buildMultipart(parts) {
  const boundary = '----bmb' + crypto.randomBytes(16).toString('hex')
  const enc = new TextEncoder()
  const chunks = []
  const push = (s) => chunks.push(typeof s === 'string' ? enc.encode(s) : s)
  for (const p of parts) {
    push('--' + boundary + '\r\nContent-Disposition: form-data; name="' + p.name + '"')
    if (p.filename) push('; filename="' + p.filename + '"')
    push('\r\nContent-Type: ' + (p.type || 'application/octet-stream') + '\r\n\r\n')
    push(p.value)
    push('\r\n')
  }
  push('--' + boundary + '--\r\n')
  const total = chunks.reduce((a, b) => a + b.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return { boundary, body: out }
}
;(async () => {
  const parts = [{ name: 'metadata', value: JSON.stringify({ entrypoint_path: EP, name: 'social-post-worker', verify_jwt: true }), type: 'application/json' }]
  const shas = {}
  for (const disk of FILES) {
    const src = fs.readFileSync(path.join(PROJ, disk), 'utf8')
    shas[disk] = crypto.createHash('sha256').update(src).digest('hex')
    parts.push({ name: 'file', filename: disk, value: src, type: 'text/typescript' })
  }
  const { boundary, body } = buildMultipart(parts)
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/functions/deploy?slug=social-post-worker', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body,
    signal: AbortSignal.timeout(120000),
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 300) }
  const ev = { step: 'G7-S4-C DEPLOY v5 (repo-relative filenames)', timestamp: new Date().toISOString(), project: REF, status: r.status, response: j, sha256: shas, note: 'ONLY social-post-worker + _shared imports; NO secrets printed' }
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('DEPLOY_STATUS ' + r.status + ' VERSION ' + (j && j.version) + ' VERIFY_JWT ' + (j && j.verify_jwt))
  console.log('RESP ' + JSON.stringify(j).slice(0, 250))
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 300)); process.exit(1) })
