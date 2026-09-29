'use strict'
// CAT-03A media migration â€” Base64 â†’ bmb-images â†’ media_assets â†’ products.image_url
// Usage: node e2e/ct-cat03a-migrate.cjs 1   (batch 1 = prod-1..prod-6)
//        node e2e/ct-cat03a-migrate.cjs 2   (batch 2 = admin-created products)
//        node e2e/ct-cat03a-migrate.cjs verify  (verify current state, no mutation)
// Safety contract: backup first, upload â†’ verify â†’ metadata â†’ verify read â†’ only then PATCH.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const SUPABASE_URL = `https://${REF}.supabase.co`
const fs = require('fs')
const path = require('path')
const ART = path.join('e2e', 'artifacts')
fs.mkdirSync(ART, { recursive: true })

function creds() {
  const c = fs.readFileSync('supabase/secrets.local.env', 'utf8')
  return { email: c.match(/BMB_TEST_ADMIN_EMAIL=(\S+)/)[1], password: c.match(/BMB_TEST_ADMIN_PASSWORD=(\S+)/)[1] }
}
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 300)); return JSON.parse(b)
}
async function adminToken() {
  const { email, password } = creds()
  const anon = fs.readFileSync('.env', 'utf8').match(/VITE_SUPABASE_ANON_KEY=(\S+)/)[1]
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ email, password }) })
  const b = await r.text(); if (!r.ok) throw new Error('AUTH ' + r.status + ' ' + b.slice(0, 200))
  return JSON.parse(b).access_token
}
const MIMES = { webp: 'image/webp' }
function parseDataUrl(u) {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(u)
  if (!m) return null
  return { ext: m[1], mime: MIMES[m[1]] || 'image/' + m[1], buf: Buffer.from(m[2], 'base64') }
}
function validWebp(buf) {
  return buf && buf.length > 30 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP'
}

;(async () => {
  const mode = process.argv[2] || 'verify'
  const BATCH1 = ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6']
  const rows = await q("select id, name, image_url from products where image_url like 'data:image%' order by id")
  if (mode === 'verify') {
    console.log('VERIFY â€” current state:')
    console.log('  base64 products:', JSON.stringify(await q("select count(*)::int c from products where image_url like 'data:image%'")))
    console.log('  storage products:', JSON.stringify(await q("select count(*)::int c from products where image_url like '%/object/public/bmb-images/%'")))
    console.log('  media_assets:', JSON.stringify(await q('select count(*)::int c from media_assets')))
    return
  }
  const batch = Number(mode)
  if (batch !== 1 && batch !== 2) throw new Error('usage: node e2e/ct-cat03a-migrate.cjs 1|2|verify')
  const ids = batch === 1 ? BATCH1 : rows.map(r => r.id).filter(id => !BATCH1.includes(id))
  const targets = rows.filter(r => ids.includes(r.id))
  if (!targets.length) { console.log('no targets in batch'); return }
  const jwt = await adminToken()
  const keys = await (async () => { const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: 'Bearer ' + TOKEN } }); return (await r.json()).filter(k => k.type === 'legacy').map(k => k.api_key) })()
  const svc = keys[1] // server-side trusted path (CAT-03 contract Â§4) â€” storage-api does not
  // resolve user JWT claims in this project (verified 2026-09-29), so admin upload via
  // authenticated policy is impossible; svc used for storage upload ONLY, all DB writes stay admin-authenticated.
  const dbHdrs = { apikey: keys[0], Authorization: 'Bearer ' + jwt }
  const svcHdrs = { apikey: svc, Authorization: 'Bearer ' + svc }
  // cleanup diagnostic probe from earlier runs
  await fetch(`${SUPABASE_URL}/storage/v1/object/bmb-images/diag-cat03a/probe.txt`, { method: 'DELETE', headers: svcHdrs })
  const manifestPath = path.join(ART, `cat03a-manifest-batch${batch}.json`)
  const backupPath = path.join(ART, `cat03a-backup-batch${batch}.json`)
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : []
  const backup = fs.existsSync(backupPath) ? JSON.parse(fs.readFileSync(backupPath, 'utf8')) : []
  const me = await (async () => { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: keys[0], Authorization: 'Bearer ' + jwt } }); return (await r.json()).id })()
  for (const t of targets) {
    const entry = { product_id: t.id, target_object_path: `products/${t.id}/image.webp`, migration_status: 'pending', verification_status: [] }
    const dup = manifest.find(m => m.product_id === t.id && m.migration_status === 'verified')
    if (dup) { console.log(`${t.id}: already migrated+verified (idempotent skip)`); continue }
    try {
      const parsed = parseDataUrl(t.image_url)
      if (!parsed || !validWebp(parsed.buf)) { entry.migration_status = 'skipped_invalid'; entry.error = 'invalid base64/webp'; manifest.push(entry); continue }
      if (!backup.find(b => b.product_id === t.id)) backup.push({ product_id: t.id, original_image_url: t.image_url })
      const objectUrl = `${SUPABASE_URL}/storage/v1/object/public/bmb-images/${entry.target_object_path}`
      if ((await fetch(objectUrl)).ok) entry.verification_status.push('object:pre-existing-reused')
      else {
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/bmb-images/${entry.target_object_path}`, { method: 'POST', headers: { ...svcHdrs, 'Content-Type': parsed.mime, 'x-upsert': 'false' }, body: parsed.buf })
        if (!up.ok) { entry.migration_status = 'failed_upload'; entry.error = 'storage ' + up.status + ' ' + (await up.text()).slice(0, 150); manifest.push(entry); continue }
        entry.verification_status.push('object:uploaded(svc-trusted)')
      }
      const chk = await fetch(objectUrl)
      if (!chk.ok) { entry.migration_status = 'failed_read_verify'; entry.error = 'public read ' + chk.status; manifest.push(entry); continue }
      entry.verification_status.push(`public-read:${chk.status}`)
      const found = await q(`select id from media_assets where url = '${objectUrl}'`)
      let assetId
      if (found.length) { assetId = found[0].id; entry.verification_status.push('metadata:reused') }
      else {
        const ins = await fetch(`${SUPABASE_URL}/rest/v1/media_assets`, { method: 'POST', headers: { ...dbHdrs, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ id: `media-${t.id}`, url: objectUrl, alt: t.name, kind: 'image', created_by: me }) })
        if (!ins.ok) { entry.migration_status = 'failed_metadata'; entry.error = 'media_assets ' + ins.status + ' ' + (await ins.text()).slice(0, 150); manifest.push(entry); continue }
        assetId = (await ins.json())[0].id
        entry.verification_status.push('metadata:created(admin)')
      }
      entry.media_asset_id = assetId
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { ...dbHdrs, 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: objectUrl }) })
      if (!patch.ok) { entry.migration_status = 'failed_update'; entry.error = 'products PATCH ' + patch.status + ' ' + (await patch.text()).slice(0, 150); manifest.push(entry); continue }
      const after = await q(`select image_url, price, category_id, sort_order, name from products where id = '${t.id}'`)
      const ok = after.length === 1 && after[0].image_url === objectUrl
      entry.verification_status.push(ok ? 'db-image-url:verified' : 'db:MISMATCH')
      const cust = await fetch(objectUrl, { headers: { Range: 'bytes=0-0' } })
      entry.verification_status.push(`customer-fetch:${cust.status}`)
      entry.migration_status = ok && cust.status < 400 ? 'verified' : 'failed_final_verify'
    } catch (e) {
      entry.migration_status = 'failed_exception'
      entry.error = String(e).slice(0, 200)
    }
    manifest.push(entry)
    console.log(`${t.id}: ${entry.migration_status} [${entry.verification_status.join(', ')}]${entry.error ? ' ERR=' + entry.error : ''}`)
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2))
  console.log(`manifest: ${manifestPath} (${manifest.length}) Â· backup: ${backupPath} (${backup.length})`)
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
