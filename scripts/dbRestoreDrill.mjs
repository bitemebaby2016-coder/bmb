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

  // 1) หาไฟล์ backup ล่าสุด (prefix 'db' ไม่ใช่ 'db/' — storageList ต่อชื่อเอง;
  //    'db/' จะกลายเป็น 'db//' แล้วเทียบ manifest ไม่เจอ)
  const listed = await storageList(cfg, 'db')
  const dumps = (listed || [])
    .map((o) => o.name)
    .filter((n) => n.endsWith('.sql.gz'))
    .sort()
  if (dumps.length === 0) fail('no .sql.gz backup found in bucket')
  const latest = dumps[dumps.length - 1]
  notice('latest backup: ' + latest)

  // manifest ของไฟล์เดียวกัน (R3 fix: dbBackup.mjs เขียน manifest.json ที่ ROOT
  // ของ bucket — เดิม drill หา 'db/manifest.json' → NoSuchKey เสมอ (drill นี้จึง
  // ไม่เคยผ่านจริง) · fallback path เก่าเผื่อ manifest ที่เคยเขียนใต้ db/)
  let manifestRaw
  try {
    manifestRaw = await storageDownload(cfg, 'manifest.json')
  } catch {
    manifestRaw = await storageDownload(cfg, 'db/manifest.json')
  }
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
    // R3: PSQL_CMD override — เครื่องที่ไม่มี psql บน PATH (เช่น Windows) ใช้
    // PSQL_CMD="docker exec -i <container> psql" ได้ (รันผ่าน shell ตามคำสั่งจริง)
    const psqlCmd = process.env.PSQL_CMD || 'psql'
    // Restore filter (documented): platform-only extensions (supabase_vault ฯลฯ)
    // ไม่มีบน vanilla PostgreSQL — recovery จริงต้องกู้ขึ้น Supabase project ใหม่
    // (ซึ่งมี extension เหล่านี้อยู่แล้ว) · drill บน vanilla PG ข้ามเฉพาะคำสั่ง
    // CREATE/ALTER/COMMENT EXTENSION ของ platform และ "นับโชว์" ทุกครั้ง (ไม่เงียบ)
    const PLATFORM_EXT = 'supabase_vault'
    let skipped = 0
    // (ก) คำสั่ง CREATE/ALTER/COMMENT ON EXTENSION ของ platform
    let restoreSql = sqlText.replace(
      new RegExp(`^(CREATE|ALTER|COMMENT)\\s+(ON\\s+)?EXTENSION[^;]*${PLATFORM_EXT}[^;]*;\\s*$`, 'gmi'),
      () => { skipped += 1; return `-- [restore-filter] skipped platform extension stmt (${PLATFORM_EXT})` },
    )
    // (ข) COPY ของตารางที่ extension เป็นเจ้าของ (vault.secrets — สร้างโดย
    //     extension; ของจริงว่าง 0 แถว) เอาทั้งบล็อกจนถึงเครื่องหมาย \.
    restoreSql = restoreSql.replace(
      /^COPY vault\.[^\n]*FROM stdin;\r?\n\\\.\r?\n?/gim,
      () => { skipped += 1; return '-- [restore-filter] skipped COPY vault.* (extension-owned table)\n' },
    )
    if (skipped > 0) {
      notice(`restore filter ✓ skipped ${skipped} platform-extension stmt(s) (${PLATFORM_EXT}) — real recovery targets a Supabase project`)
    }
    // Prelude: standard Supabase roles (มีอยู่แล้วบน Supabase project จริง —
    // recovery จริงขึ้น project ใหม่ก็มี roles เหล่านี้) · vanilla PG ต้องสร้างก่อน
    // ไม่งั้น dump ที่มี GRANT ถึง anon/authenticated/service_role จะพัง
    const prelude = `DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;`
    const pre = spawnSync(psqlCmd, [url, '-v', 'ON_ERROR_STOP=1', '-q'], {
      input: prelude,
      encoding: 'utf8',
      shell: Boolean(process.env.PSQL_CMD),
    })
    if (pre.status !== 0) fail('role prelude failed: ' + String(pre.stderr || pre.error || '').slice(0, 300))
    notice('role prelude ✓ anon/authenticated/service_role ready')
    const spawnOpts = {
      input: restoreSql,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: Boolean(process.env.PSQL_CMD),
    }
    const r = spawnSync(psqlCmd, [url, '-v', 'ON_ERROR_STOP=1', '-q'], spawnOpts)
    if (r.status !== 0) fail('psql restore failed: ' + String(r.stderr || r.error || '').slice(0, 400))
    const count = spawnSync(psqlCmd, [url, '-tAc', "select count(*) from information_schema.tables where table_schema='public'"], {
      encoding: 'utf8',
      shell: Boolean(process.env.PSQL_CMD),
    })
    notice('scratch restore ✓ public tables=' + String(count.stdout || '').trim())
  } else {
    notice('psql restore: SKIPPED (run with --psql + RESTORE_DATABASE_URL=local scratch DB to rehearse)')
  }

  console.log('dbRestoreDrill: PASS')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => fail(String((e && e.message) || e)))
}