// R129 — migration ledger check (UNIVERSAL_MASTER_AI_RULES §18 / AI_ENTRYPOINT rule 20)
//   เทียบ: local supabase/migrations/*.sql  ⟷  remote supabase_migrations.schema_migrations
//   (อ่าน remote ผ่าน Management API POST /database/query ด้วย PAT จาก .env.local — ห้ามพิมพ์ PAT ลงไฟล์)
//   verdict: MATCH (เท่ากันทุกเวอร์ชัน) | LEDGER_DRIFT_LOCAL_ONLY | LEDGER_DRIFT_REMOTE_ONLY
//   evidence → e2e/_r129_migration_ledger.json
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(ROOT, 'e2e', '_r129_migration_ledger.json')

function readEnv(file) {
  const out = {}
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && m[2] && !line.trim().startsWith('#')) out[m[1]] = m[2]
    }
  } catch { /* */ }
  return out
}

;(async () => {
  const E = readEnv(path.join(ROOT, '.env.local'))
  const out = { at: new Date().toISOString(), projectRef: REF }

  // local — ชื่อไฟล์แบบ 3 หลัก (001_initial_schema.sql … 233_ocr_documents.sql)
  const dir = path.join(ROOT, 'supabase', 'migrations')
  const localFiles = fs.readdirSync(dir).filter((f) => /^(\d{3})_.*\.sql$/.test(f)).sort()
  const localVersions = localFiles.map((f) => f.slice(0, 3))
  out.localCount = localVersions.length
  out.localMax = localVersions[localVersions.length - 1] || null

  // remote ledger (schema_migrations — ตาราง ledger ของ supabase migrations เอง)
  const res = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + E.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select version, name from supabase_migrations.schema_migrations order by version' }),
  })
  out.remoteHttpStatus = res.status
  if (!res.ok) {
    out.error = (await res.text()).slice(0, 300)
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
    console.log('R129_LEDGER_FAIL http=' + res.status + ' ' + out.error)
    process.exit(1)
  }
  const rows = await res.json()
  const remoteVersions = rows.map((r) => String(r.version))
  out.remoteCount = remoteVersions.length
  out.remoteMax = remoteVersions[remoteVersions.length - 1] || null

  const remoteSet = new Set(remoteVersions)
  const localSet = new Set(localVersions)
  out.localOnly = localVersions.filter((v) => !remoteSet.has(v))
  out.remoteOnly = remoteVersions.filter((v) => !localSet.has(v))
  out.drift = out.localOnly.length > 0 || out.remoteOnly.length > 0
  out.verdict = out.drift
    ? (out.localOnly.length ? 'LEDGER_DRIFT_LOCAL_ONLY' : 'LEDGER_DRIFT_REMOTE_ONLY')
    : 'MATCH'

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('R129_LEDGER local=' + out.localCount + ' (max ' + out.localMax + ') remote=' + out.remoteCount + ' (max ' + out.remoteMax + ')')
  console.log('R129_LEDGER localOnly=' + JSON.stringify(out.localOnly) + ' remoteOnly=' + JSON.stringify(out.remoteOnly))
  console.log('R129_LEDGER_VERDICT ' + out.verdict)
  process.exit(0)
})().catch((e) => { console.error('LEDGER_CHECK_FAILED ' + String(e).slice(0, 300)); process.exit(1) })
