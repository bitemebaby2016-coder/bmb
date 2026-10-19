// ============================================
// Bite Me Baby — Daily DB backup → Google Cloud Storage (JSON API)
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
//
// Destination: GCS bucket `bmb-db-backups-prod` (Owner-provided).
// Credential: service-account JSON via env GCS_SERVICE_ACCOUNT_JSON (preferred)
//   or GOOGLE_APPLICATION_CREDENTIALS (path). NEVER committed to git.
//
// Integrity: every upload is re-downloaded and sha256-verified before the run
//   is declared successful; manifest.json records sizes + hashes.
// Retention: daily backups kept N days (default 30), monthly (first-of-month)
//   kept M months (default 12). Deterministic selection (unit-tested).
//
// Usage:
//   node scripts/gcsBackup.mjs            # pg_dump + gzip + upload + verify
//   node scripts/gcsBackup.mjs --verify   # re-verify latest manifest integrity
//   node scripts/gcsBackup.mjs --dry-run  # compute names/retention only
// ============================================
import { createHash, createSign } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'

export const DAILY_KEEP_DAYS = Number(process.env.BACKUP_DAILY_KEEP_DAYS || 30)
export const MONTHLY_KEEP_MONTHS = Number(process.env.BACKUP_MONTHLY_KEEP_MONTHS || 12)

// ---------- pure helpers (unit-tested) ----------

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

/** db/bmb-db-YYYYMMDD-HHMMSS.sql.gz — deterministic per timestamp (UTC). */
export function buildDbObjectName(date) {
  const iso = date.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `db/bmb-db-${iso.slice(0, 8)}-${iso.slice(8)}.sql.gz`
}

export function buildManifest(files) {
  return {
    generated_at: new Date().toISOString(),
    tool: 'bmb-gcs-backup/1',
    files: files.map((f) => ({ name: f.name, size: f.size, sha256: f.sha256 })),
  }
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

// ---------- service account / auth (GCS JSON API + OAuth2 JWT-bearer) ----------

export function parseServiceAccount() {
  const raw = process.env.GCS_SERVICE_ACCOUNT_JSON
  if (raw && raw.trim().startsWith('{')) return JSON.parse(raw)
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (path && existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
  throw new Error('GCS credentials missing: set GCS_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS')
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export async function getAccessToken(sa) {
  const nowSec = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const sig = b64url(signer.sign(sa.private_key))
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claims}.${sig}`,
  })
  if (!resp.ok) throw new Error(`token exchange failed: HTTP ${resp.status}`)
  return (await resp.json()).access_token
}

// ---------- GCS JSON API surface ----------

export async function gcsUpload(token, bucket, name, buffer, contentType = 'application/octet-stream') {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(name)}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: buffer,
  })
  if (!resp.ok) throw new Error(`upload ${name} failed: HTTP ${resp.status}`)
  return resp.json()
}

export async function gcsDownload(token, bucket, name) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!resp.ok) throw new Error(`download ${name} failed: HTTP ${resp.status}`)
  return Buffer.from(await resp.arrayBuffer())
}

export async function gcsList(token, bucket, prefix) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(prefix)}&fields=items(name,size)`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!resp.ok) throw new Error(`list failed: HTTP ${resp.status}`)
  const json = await resp.json()
  return (json.items ?? []).map((i) => ({ name: i.name, size: Number(i.size || 0) }))
}

export async function gcsDelete(token, bucket, name) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}`
  const resp = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!resp.ok) throw new Error(`delete ${name} failed: HTTP ${resp.status}`)
}

// ---------- main ----------

function runPgDump(databaseUrl) {
  const r = spawnSync('pg_dump', [databaseUrl, '--no-owner', '--no-acl', '-F', 'p'], { maxBuffer: 1024 * 1024 * 512 })
  if (r.error) throw new Error(`pg_dump failed to start: ${r.error.message}`)
  if (r.status !== 0) throw new Error(`pg_dump exit ${r.status}: ${String(r.stderr).slice(0, 500)}`)
  return r.stdout
}

async function verifyByName(token, bucket, name, expectedSha) {
  const downloaded = await gcsDownload(token, bucket, name)
  const raw = name.endsWith('.gz') ? gunzipSync(downloaded) : downloaded
  const sha = sha256Hex(name.endsWith('.gz') ? gzipSync(raw) : raw)
  // verify the stored bytes hash == recorded hash (compressed form for .gz)
  const storedSha = sha256Hex(downloaded)
  return { ok: storedSha === expectedSha || sha === expectedSha, storedSha, rawSize: raw.length }
}

export async function main(argv = process.argv.slice(2)) {
  const bucket = process.env.GCS_BUCKET_NAME || 'bmb-db-backups-prod'
  const dryRun = argv.includes('--dry-run')
  const verifyOnly = argv.includes('--verify')
  const databaseUrl = process.env.BMB_DATABASE_URL || process.env.DATABASE_URL

  const sa = parseServiceAccount()
  const token = await getAccessToken(sa)
  console.log(`[gcsBackup] bucket=${bucket}`)

  if (verifyOnly) {
    const list = await gcsList(token, bucket, 'manifest')
    if (list.length === 0) throw new Error('no manifest found — nothing to verify')
    const manifest = JSON.parse((await gcsDownload(token, bucket, 'manifest.json')).toString('utf8'))
    for (const f of manifest.files) {
      const v = await verifyByName(token, bucket, f.name, f.sha256)
      if (!v.ok) throw new Error(`INTEGRITY FAIL: ${f.name}`)
      console.log(`[gcsBackup] verified ${f.name} (${v.rawSize} bytes raw)`)
    }
    console.log('[gcsBackup] VERIFY OK — all manifest hashes match stored objects')
    return
  }

  if (!databaseUrl) throw new Error('BMB_DATABASE_URL (or DATABASE_URL) is required for backup')
  const dump = runPgDump(databaseUrl)
  const gz = gzipSync(dump)
  const name = buildDbObjectName(new Date())
  const sha = sha256Hex(gz)
  console.log(`[gcsBackup] dump=${dump.length}B gzip=${gz.length}B name=${name} sha256=${sha}`)

  if (dryRun) {
    const existing = (await gcsList(token, bucket, 'db/')).map((o) => o.name)
    console.log('[gcsBackup] dry-run retention candidates:', retentionCandidates(existing, new Date()))
    return
  }

  await gcsUpload(token, bucket, name, gz, 'application/gzip')
  const manifest = buildManifest([{ name, size: gz.length, sha256: sha }])
  await gcsUpload(token, bucket, 'manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json')

  // INTEGRITY: re-download the uploaded dump and compare hashes (fail closed)
  const v = await verifyByName(token, bucket, name, sha)
  if (!v.ok) throw new Error(`INTEGRITY FAIL after upload: ${name}`)

  // retention (delete only names matching the deterministic pattern)
  const existing = (await gcsList(token, bucket, 'db/')).map((o) => o.name)
  const doomed = retentionCandidates(existing, new Date())
  for (const d of doomed) {
    await gcsDelete(token, bucket, d)
    console.log(`[gcsBackup] retention deleted ${d}`)
  }
  console.log(`[gcsBackup] BACKUP OK ${name} · verified sha256 · retention pruned ${doomed.length}`)
}

// run as CLI only (importable for tests without side effects)
import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('[gcsBackup] FAILED:', e.message)
    process.exit(1)
  })
}