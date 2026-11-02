// R56 — parity มิเกรชั่นแบบ LIVE (ยิง query production ledger ตรง ๆ)
// ทำไม่ใหม่: r21fMigParity.cjs อ่าน e2e/r21fSchemaProbe.json = snapshot เก่า (ledger=173)
// → คำตอบ "174-182 ค้าง" ของไฟล์เดิม = หลักฐานเก่า ไม่ใช่สถานะจริง
// ไฟล์นี้ query จริงทุกครั้ง → e2e/r56MigParity-result.json
// exit: 0 = ตรงกันไม่มีค้าง · 2 = มีไฟล์ค้าง (ต้อง apply) · 1 = query ล้มเหลว
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 300))
  return t
}

;(async () => {
  const localNums = [...new Set(
    fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
      .filter((f) => /^[0-9]/.test(f))
      .map((f) => f.split('_')[0]),
  )]
  const rows = JSON.parse(await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version::int DESC'))
  const ledger = rows.map((r) => String(r.version))
  const missing = localNums.filter((v) => !ledger.includes(v)) // มีไฟล์ แต่ยังไม่ record ใน ledger
  const extra = ledger.filter((v) => !localNums.includes(v))   // record แต่ไม่มีไฟล์ใน repo
  const out = {
    at: new Date().toISOString(),
    localCount: localNums.length,
    ledgerCount: ledger.length,
    ledgerTop: ledger.slice(0, 5),
    missing,
    extra,
    PENDING: missing.length > 0,
    ALL_PASS: missing.length === 0 && extra.length === 0,
  }
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r56MigParity-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out))
  process.exit(out.PENDING ? 2 : 0)
})().catch((e) => { console.error('PARITY_FAILED', String(e).slice(0, 300)); process.exit(1) })
