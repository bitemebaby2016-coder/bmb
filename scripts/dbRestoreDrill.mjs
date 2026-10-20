// ============================================
// Bite Me Baby — dbRestoreDrill (backup restore rehearsal, READ-ONLY on prod)
// ============================================
// คำถาม Owner 20 ต.ค.: "backup ทดสอบ restore จริงหรือยัง?" — เครื่องมือนี้ตอบ
// แบบหลักฐานได้โดยไม่แตะ production:
//   1. ดึงไฟล์ backup ล่าสุดจาก bucket `db-backups` (private) ลงเครื่อง
//   2. เทียบ size + sha256 กับ manifest.json (ตัวเดียวกับที่ backup เขียนไว้)
//   3. gunzip → ตรวจโครงสร้าง dump (SQL header / CREATE TABLE / COPY)
//   4. (ทางเลือก --psql) restore ลง scratch DB (RESTORE_DATABASE_URL) แล้วนับ
//      ตารางจริง — ห้ามชี้ไปที่ production เด็ดขาด (script ปฏิเสธถ้า URL ตรงกับ
//      project ref ของ production)
//
// Usage:
//   node scripts/dbRestoreDrill.mjs          # ตรวจแบบไม่แตะ DB ใด ๆ (safe ทุกที่)
//   node scripts/dbRestoreDrill.mjs --psql   # + restore ลง scratch DB (ต้องตั้ง
//                                            #   RESTORE_DATABASE_URL ชี้ local เท่านั้น)
//
// Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env) — ห้าม commit
// Exit code: 0 = drill ผ่านทุกขั้น · ไม่ผ่าน = fail closed
// ============================================
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  sha256Hex,
  notice,
  storageConfig,
  storageList,
  storageDownload,
  getBucketInfo,
  normalizeDatabaseUrl,
} from './dbBackup.mjs'

const PROD_REF = 'ivkdfognyiwjcmrhcnwz'

function fail(msg) {
  console.error('::error::dbRestoreDrill FAILED: ' + msg)
  process.exit(1)
}

/** ตรวจโครงสร้าง dump แบบหยาบแต่จับพังได้จริง: header, CREATE TABLE, COPY */
export function inspectDump(sqlText) {
  const tables = (sqlText.match(/CREATE TABLE/g) || []).length
  const copies = (sqlText.match(/^COPY /gm) || []).length
  const hasHeader = sqlText.startsWith('--') || sqlText.startsWith('SET ') || sqlText.startsWith('SELECT pg_catalog')
  return { ok: hasHeader && tables > 0 && copies > 0, tables, copies, hasHeader }
}

export async function main(argv = process.argv.slice(2)) {
  const doPsql = argv.includes('--psql')

  // 0) bucket ต้องเป็น private เสมอ
  const cfg = storageConfig()
  const bucket = await getBucketInfo(cfg)
  if (bucket && bucket.public) fail('bucket db-backups is PUBLIC (must be private)')
  notice('bucket privacy: private ✓')

  // 1) หาไฟล์ backup ล่าสุด
  const listed = await storageList(cfg, 'db/')
  const dumps = (listed || [])
    .map((o) => o.name)
    .filter((n) => n.endsWith('.sql.gz'))
    .sort()
  if (dumps.length === 0) fail('no .sql.gz backup found in bucket')
  const latest = dumps[dumps.length - 1]
  notice('latest backup: ' + latest)

  // manifest ของไฟล์เดียวกัน
  const manifestRaw = await storageDownload(cfg, 'db/manifest.json')
  const manifest = JSON.parse(manifestRaw.toString('utf8'))
  const entry = (manifest.files || []).find((f) => f.name === latest)
  if (!entry) fail('manifest.json has no entry for ' + latest)

  // 2) เทียบ size + sha256 (ตัวเดียวกับตอน backup)
  const gz = await storageDownload(cfg, latest)
  if (gz.length !== entry.size) fail(`size mismatch: got ${gz.length}, manifest ${entry.size}`)
  const sha = sha256Hex(gz)
  if (sha !== entry.sha256) fail(`sha256 mismatch: got ${sha}, manifest ${entry.sha256}`)
  notice(`integrity ✓ size=${gz.length} sha256=${sha.slice(0, 16)}…`)

  // 3) gunzip + ตรวจโครงสร้าง dump
  let sqlText
  try {
    sqlText = gunzipSync(gz).toString('utf8')
  } catch (e) {
    fail('gunzip failed: ' + (e && e.message))
  }
  const dump = inspectDump(sqlText)
  if (!dump.ok) fail(`dump structure invalid: ${JSON.stringify(dump)}`)
  notice(`dump structure ✓ header=${dump.hasHeader} CREATE TABLE=${dump.tables} COPY=${dump.copies}`)

  // 4) (ทางเลือก) restore ลง scratch DB — ห้ามชี้ production
  if (doPsql) {
    const rawUrl = process.env.RESTORE_DATABASE_URL || ''
    if (!rawUrl) fail('RESTORE_DATABASE_URL is empty')
    const url = normalizeDatabaseUrl(rawUrl)
    if (url.includes(PROD_REF)) fail('RESTORE_DATABASE_URL points at PRODUCTION — drill must use a scratch DB')
    const r = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q'], {
      input: sqlText,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    if (r.status !== 0) fail('psql restore failed: ' + String(r.stderr || '').slice(0, 400))
    const count = spawnSync('psql', [url, '-tAc', "select count(*) from information_schema.tables where table_schema='public'"], { encoding: 'utf8' })
    notice('scratch restore ✓ public tables=' + String(count.stdout || '').trim())
  } else {
    notice('psql restore: SKIPPED (run with --psql + RESTORE_DATABASE_URL=local scratch DB to rehearse)')
  }

  console.log('dbRestoreDrill: PASS')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => fail(String((e && e.message) || e)))
}