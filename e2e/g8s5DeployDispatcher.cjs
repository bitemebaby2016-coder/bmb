// G8-S5 — deploy queue-dispatcher via Management API multipart (T2 proven pattern)
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || fs.readFileSync(path.join(PROJ, '.env.local'), 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim()
const REF = 'ivkdfognyiwjcmrhcnwz'
const EP = 'supabase/functions/queue-dispatcher/index.ts'
const FILES = [EP]
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
  const parts = [{ name: 'metadata', value: JSON.stringify({ entrypoint_path: EP, name: 'queue-dispatcher', verify_jwt: true }), type: 'application/json' }]
  const shas = {}
  for (const disk of FILES) {
    const src = fs.readFileSync(path.join(PROJ, disk), 'utf8')
    shas[disk] = crypto.createHash('sha256').update(src).digest('hex')
    parts.push({ name: 'file', filename: disk, value: src, type: 'text/typescript' })
  }
  const { boundary, body } = buildMultipart(parts)
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/functions/deploy?slug=queue-dispatcher', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body,
    signal: AbortSignal.timeout(120000),
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 300) }
  console.log('DEPLOY_STATUS ' + r.status + ' VERSION ' + (j && j.version) + ' VERIFY_JWT ' + (j && j.verify_jwt))
  if (r.status >= 400) console.log('RESP ' + JSON.stringify(j).slice(0, 300))
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 300)); process.exit(1) })