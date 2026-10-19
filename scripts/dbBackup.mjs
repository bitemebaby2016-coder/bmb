// ============================================
// Bite Me Baby — Daily DB backup → Supabase Storage (private bucket)
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
//
// Destination: Supabase Storage PRIVATE bucket `db-backups` (default).
//   Refactored from GCS (2026-10-19): GCP Organization Policy "Secure by
//   Default" blocks service-account key JSON — ไม่มีการพึ่งพา GCP credentials.
// Credential: SUPABASE_SERVICE_ROLE_KEY (repo secret / supabase/secrets.local.env).
//   NEVER committed to git. Bucket ต้องเป็น Private เสมอ (--verify ตรวจสอบและ
//   fail ทันทีถ้าถูกเปิดเป็น public).
//
// Integrity (size + checksum ก่อนและหลัง upload — fail closed):
//   1. ก่อน upload: วัด size + sha256 ของไฟล์ .sql.gz
//   2. หลัง upload: ดาวน์โหลดกลับมาเทียบ size + sha256 แบบ byte-for-byte
//   3. manifest.json บันทึก name/size/sha256 เป็น audit surface ของ --verify
// Retention: daily backups kept N days (default 30), monthly (first-of-month)
//   kept M months (default 12). Deterministic selection (unit-tested).
//
// Usage:
//   node scripts/dbBackup.mjs            # pg_dump + gzip + upload + verify
//   node scripts/dbBackup.mjs --verify   # re-verify manifest + .sql.gz + privacy
//   node scripts/dbBackup.mjs --dry-run  # compute names/retention only (no upload)
//
// Env:
//   BMB_DATABASE_URL          required for backup (pg_dump source)
//   SUPABASE_URL              default https://ivkdfognyiwjcmrhcnwz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY required (storage read/write/delete on the bucket)
//   SUPABASE_BACKUP_BUCKET    default db-backups
//   BACKUP_MAX_BYTES          default 52428800 (bucket file-size limit 50 MB)
//   PGDUMP_CMD                default 'pg_dump' (override e.g.
//                             'docker run --rm postgres:17-alpine pg_dump')
// ============================================
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'

export const DAILY_KEEP_DAYS = Number(process.env.BACKUP_DAILY_KEEP_DAYS || 30)
export const MONTHLY_KEEP_MONTHS = Number(process.env.BACKUP_MONTHLY_KEEP_MONTHS || 12)
export const MAX_BACKUP_BYTES = Number(process.env.BACKUP_MAX_BYTES || 52428800) // 50 MB bucket limit

// ---------- pure helpers (unit-tested) ----------

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

/** GitHub Actions annotation — แสดงบนหน้า run ได้โดยไม่ต้องเปิด log (log ต้อง sign-in) */
export function notice(msg) {
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::notice::${msg}`)
}

/**
 * Normalize + validate the pg connection string before use (fail closed).
 * Accepts libpq URI (postgres:// or postgresql://) or keyword/value format
 * (host=… user=… password=…). Returns null for anything else — a bare
 * host/name string would make pg_dump silently try the LOCAL socket.
 */
export function normalizeDatabaseUrl(raw) {
  const v = String(raw || '').trim().replace(/^["']|["']$/g, '')
  if (/^postgres(ql)?:\/\//i.test(v)) return v
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(v)) return v // libpq keyword/value format
  return null
}

/** db/bmb-db-YYYYMMDD-HHMMSS.sql.gz — deterministic per timestamp (UTC). */
export function buildDbObjectName(date) {
  const iso = date.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `db/bmb-db-${iso.slice(0, 8)}-${iso.slice(8)}.sql.gz`
}

export function buildManifest(files) {
  return {
    generated_at: new Date().toISOString(),
    tool: 'bmb-db-backup/1',
    files: files.map((f) => ({ name: f.name, size: f.size, sha256: f.sha256 })),
  }
}

/** Size gate BEFORE upload — bucket file_size_limit is 50 MB; fail closed with a
 *  clear message instead of a cryptic storage API error. */
export function checkBackupSize(bytes, maxBytes = MAX_BACKUP_BYTES) {
  return { ok: bytes <= maxBytes, size: bytes, limit: maxBytes }
}

/**
 * Retention: keep everything within `dailyKeepDays`; beyond that keep only the
 * FIRST backup of each month within `monthlyKeepMonths`; delete the rest.
 * Names must match db/bmb-db-YYYYMMDD-HHMMSS.sql.gz (UTC-stamped).
 */
export function retentionCandidates(names, now, dailyKeepDays = DAILY_KEEP_DAYS, monthlyKeepMonths = MONTHLY_KEEP_MONTHS) {
  const parsed = []
  for (const name of names) {
    const m = /^db\/bmb-db-(\d{4})(\d{2})(\d{2})-(\d{6})\.sql\.gz$/.exec(name)
    if (!m) continue
    parsed.push({ name, date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) })
  }
  parsed.sort((a, b) => a.name.localeCompare(b.name))
  const dailyCutoff = new Date(now.getTime() - dailyKeepDays * 86400_000)
  const monthlyCutoff = new Date(now.getTime())
  monthlyCutoff.setUTCMonth(monthlyCutoff.getUTCMonth() - monthlyKeepMonths)

  const firstOfMonth = new Map()
  for (const p of parsed) {
    const key = p.date.toISOString().slice(0, 7)
    if (!firstOfMonth.has(key)) firstOfMonth.set(key, p.name)
  }

  const keep = new Set()
  for (const p of parsed) {
    if (p.date >= dailyCutoff) keep.add(p.name)
    else if (p.date >= monthlyCutoff && firstOfMonth.get(p.date.toISOString().slice(0, 7)) === p.name) keep.add(p.name)
  }
  return parsed.map((p) => p.name).filter((n) => !keep.has(n))
}

// ---------- Supabase Storage surface (service-role, REST — no SDK dep) ----------

export function storageConfig() {
  const url = (process.env.SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required (service_role key — never commit it)')
  const bucket = process.env.SUPABASE_BACKUP_BUCKET || 'db-backups'
  return { base: `${url}/storage/v1`, key, bucket }
}

function authHeaders(key, extra = {}) {
  // Supabase new secret keys (sb_secret_…) require BOTH headers on storage routes
  // (Authorization-only fails with "Invalid Compact JWS").
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra }
}

export async function storageUpload(cfg, name, buffer, contentType = 'application/octet-stream') {
  const resp = await fetch(`${cfg.base}/object/${cfg.bucket}/${name}`, {
    method: 'POST',
    headers: authHeaders(cfg.key, { 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': 'no-store' }),
    body: buffer,
  })
  if (!resp.ok) throw new Error(`upload ${name} failed: HTTP ${resp.status} ${String(await resp.text()).slice(0, 300)}`)
  return resp.json()
}

export async function storageDownload(cfg, name) {
  const resp = await fetch(`${cfg.base}/object/${cfg.bucket}/${name}`, { headers: authHeaders(cfg.key) })
  if (!resp.ok) throw new Error(`download ${name} failed: HTTP ${resp.status}`)
  return Buffer.from(await resp.arrayBuffer())
}

export async function storageList(cfg, prefix) {
  const resp = await fetch(`${cfg.base}/object/list/${cfg.bucket}`, {
    method: 'POST',
    headers: authHeaders(cfg.key, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  })
  if (!resp.ok) throw new Error(`list failed: HTTP ${resp.status} ${String(await resp.text()).slice(0, 300)}`)
  const items = await resp.json()
  return (Array.isArray(items) ? items : []).map((i) => {
    const name = i.name.includes('/') ? i.name : `${prefix}/${i.name}`
    return { name, size: Number(i.metadata?.size ?? i.metadata?.contentLength ?? 0) }
  })
}

export async function storageDelete(cfg, name) {
  const resp = await fetch(`${cfg.base}/object/${cfg.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(cfg.key),
  })
  if (!resp.ok) throw new Error(`delete ${name} failed: HTTP ${resp.status}`)
}

/** Bucket metadata — --verify asserts PRIVATE + reports the file-size limit. */
export async function getBucketInfo(cfg) {
  // Storage API route naming differs by deployment (/buckets vs legacy /bucket).
  let resp = await fetch(`${cfg.base}/buckets`, { headers: authHeaders(cfg.key) })
  if (resp.status === 404) resp = await fetch(`${cfg.base}/bucket`, { headers: authHeaders(cfg.key) })
  if (!resp.ok) throw new Error(`buckets list failed: HTTP ${resp.status}`)
  const list = await resp.json()
  const b = (Array.isArray(list) ? list : []).find((x) => x.id === cfg.bucket || x.name === cfg.bucket)
  if (!b) throw new Error(`bucket ${cfg.bucket} not found`)
  return { id: b.id, public: !!b.public, file_size_limit: b.file_size_limit ?? null }
}

// ---------- main ----------

function runPgDump(databaseUrl) {
  const cmdParts = (process.env.PGDUMP_CMD || 'pg_dump').trim().split(/\s+/)
  const bin = cmdParts[0]
  const args = [...cmdParts.slice(1), databaseUrl, '--no-owner', '--no-acl', '-F', 'p']
  const r = spawnSync(bin, args, { maxBuffer: 1024 * 1024 * 512 })
  if (r.error) throw new Error(`pg_dump failed to start: ${r.error.message}`)
  if (r.status !== 0) {
    const err = String(r.stderr || '').slice(0, 500)
    let hint = ''
    if (/no password supplied|password authentication failed/i.test(err)) {
      hint = ' — ตรวจว่า secret BMB_DATABASE_URL มีรหัสผ่านใน URI (postgresql://user:PASSWORD@host:port/db) และไม่มีช่องว่าง/บรรทัดใหม่ต่อท้าย'
    } else if (/newer than this pg_dump|server version mismatch/i.test(err)) {
      hint = ' — pg_dump client version ไม่ตรงกับ server (17.6) — ต้องใช้ client 17.x ล่าสุด (PGDG binary หรือ docker postgres:17)'
    }
    throw new Error(`pg_dump exit ${r.status}: ${err}${hint}`)
  }
  return r.stdout
}

/** Download the stored object and byte-compare size + sha256 (fail closed). */
export async function verifyStoredObject(cfg, name, expectedSize, expectedSha) {
  const downloaded = await storageDownload(cfg, name)
  const storedSha = sha256Hex(downloaded)
  return {
    ok: downloaded.length === expectedSize && storedSha === expectedSha,
    storedSize: downloaded.length,
    storedSha,
    expectedSize,
    expectedSha,
  }
}

export async function main(argv = process.argv.slice(2)) {
  const cfg = storageConfig()
  const dryRun = argv.includes('--dry-run')
  const verifyOnly = argv.includes('--verify')
  const databaseUrl = process.env.BMB_DATABASE_URL || process.env.DATABASE_URL
  console.log(`[dbBackup] bucket=${cfg.bucket} base=${cfg.base}`)

  if (verifyOnly) {
    // 1) bucket privacy + size limit (fail closed if the bucket is public)
    const bucket = await getBucketInfo(cfg)
    console.log(`[dbBackup] bucket public=${bucket.public} file_size_limit=${bucket.file_size_limit ?? 'unset'}`)
    if (bucket.public) throw new Error('SECURITY FAIL: bucket is PUBLIC — backup bucket must stay private')

    // 2) manifest hashes must match stored bytes
    let manifest
    try {
      manifest = JSON.parse((await storageDownload(cfg, 'manifest.json')).toString('utf8'))
    } catch {
      throw new Error('no manifest.json found — nothing to verify (รัน backup ก่อน แล้วใช้ --verify)')
    }
    for (const f of manifest.files ?? []) {
      const v = await verifyStoredObject(cfg, f.name, f.size, f.sha256)
      if (!v.ok) throw new Error(`INTEGRITY FAIL: ${f.name} (size ${v.storedSize}/${v.expectedSize}, sha ${v.storedSha} != ${v.expectedSha})`)
      console.log(`[dbBackup] verified ${f.name} (${v.storedSize} bytes, sha256 ok)`)
    }

    // 3) at least one .sql.gz must actually exist in the bucket
    const existing = await storageList(cfg, 'db')
    const dumps = existing.filter((o) => o.name.endsWith('.sql.gz'))
    if (dumps.length === 0) throw new Error('VERIFY FAIL: no .sql.gz present in bucket')
    console.log(`[dbBackup] .sql.gz in bucket: ${dumps.length} object(s)`)
    for (const d of dumps.slice(-5)) console.log(`[dbBackup]   - ${d.name} (${d.size} B)`)

    console.log('[dbBackup] VERIFY OK — manifest hashes match, .sql.gz present, bucket private')
  notice('daily-backup VERIFY OK — manifest hashes match, .sql.gz present, bucket private')
    return
  }

  if (!databaseUrl) throw new Error('BMB_DATABASE_URL (or DATABASE_URL) is required for backup')
  const conn = normalizeDatabaseUrl(databaseUrl)
  if (!conn) {
    throw new Error(
      'BMB_DATABASE_URL ไม่ใช่ connection string ที่ถูกต้อง (ค่าปัจจุบันไม่มี "://" และไม่ใช่รูปแบบ host=…) — ' +
        'ต้องเป็น URI: postgresql://USER:PASSWORD@HOST:PORT/DB · คัดลอกจาก Supabase Dashboard → ปุ่ม Connect → แท็บ URI → Session pooler ' +
        'แล้วแทน [YOUR-PASSWORD] ด้วยรหัสผ่านฐานข้อมูลจริง (ห้ามมีเครื่องหมายคำพูดครอบ/ช่องว่างต่อท้าย)',
    )
  }
  const dump = runPgDump(conn)
  const gz = gzipSync(dump)
  const name = buildDbObjectName(new Date())
  const sha = sha256Hex(gz)

  // size + checksum BEFORE upload (fail closed on size limit)
  const sizeCheck = checkBackupSize(gz.length)
  console.log(`[dbBackup] dump=${dump.length}B gzip=${gz.length}B name=${name} sha256=${sha}`)
  if (!sizeCheck.ok) {
    throw new Error(
      `SIZE FAIL: backup is ${sizeCheck.size} bytes > limit ${sizeCheck.limit} — เพิ่ม BACKUP_MAX_BYTES/ขยาย bucket limit หรือย้ายไป storage tier อื่น`,
    )
  }

  if (dryRun) {
    const existing = (await storageList(cfg, 'db')).map((o) => o.name)
    console.log('[dbBackup] dry-run retention candidates:', retentionCandidates(existing, new Date()))
    console.log('[dbBackup] dry-run done — no upload performed')
    return
  }

  // upload + audit manifest
  await storageUpload(cfg, name, gz, 'application/gzip')
  const manifest = buildManifest([{ name, size: gz.length, sha256: sha }])
  await storageUpload(cfg, 'manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json')

  // INTEGRITY: re-download the uploaded dump and byte-compare size + sha256 (fail closed)
  const v = await verifyStoredObject(cfg, name, gz.length, sha)
  if (!v.ok) throw new Error(`INTEGRITY FAIL after upload: ${name} (size ${v.storedSize}/${v.expectedSize}, sha ${v.storedSha})`)

  // retention (delete only names matching the deterministic pattern)
  const existing = (await storageList(cfg, 'db')).map((o) => o.name)
  const doomed = retentionCandidates(existing, new Date())
  for (const d of doomed) {
    await storageDelete(cfg, d)
    console.log(`[dbBackup] retention deleted ${d}`)
  }
  console.log(`[dbBackup] BACKUP OK ${name} · verified size+sha256 · retention pruned ${doomed.length}`)
  notice(`daily-backup OK — ${name} · sha256=${sha} · gzip ${gz.length} B · retention pruned ${doomed.length}`)
}

// run as CLI only (importable for tests without side effects)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('[dbBackup] FAILED:', e.message)
    process.exit(1)
  })
}