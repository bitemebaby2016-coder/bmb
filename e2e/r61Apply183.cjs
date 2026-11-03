// R61 — apply migration 183 (promotions.banner_mascot) บน production + record ledger + verify
// Pattern = r50Apply174_181 (Management API ต่อไฟล์ · ledger ON CONFLICT DO NOTHING · re-run ปลอดภัย)
// evidence → e2e/r61Apply183-result.json
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const V = '183'
const FILE = '183_promo_banner_mascot.sql'

const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}

;(async () => {
  const out = { at: new Date().toISOString(), file: FILE, steps: [] }
  out.precheck = await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3')

  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', FILE), 'utf8')
    .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

  const has = await q(`SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${V}'`)
  if (String(has).includes('"1"') && !process.env.FORCE) {
    out.steps.push({ action: 'already_in_ledger' })
  } else {
    const res = await q(sql)
    const failed = /"message"/i.test(res) && /error/i.test(res) && !/IF NOT EXISTS/i.test(res)
    if (failed) {
      out.steps.push({ action: 'apply_failed', detail: String(res).slice(0, 400) })
      fs.writeFileSync(path.join(ROOT, 'e2e', 'r61Apply183-result.json'), JSON.stringify(out, null, 2))
      console.log('XMARK APPLY_FAILED ' + String(res).slice(0, 300))
      process.exit(1)
    }
    out.steps.push({ action: 'applied', detail: String(res).slice(0, 200) })
    const rec = await q(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${V}', '${FILE}', '{}'::text[]) ON CONFLICT (version) DO NOTHING`)
    out.steps.push({ action: 'ledger_recorded', detail: String(rec).slice(0, 120) })
  }

  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    column: await q("SELECT column_name FROM information_schema.columns WHERE table_name='promotions' AND column_name='banner_mascot'"),
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
  }
  out.ALL_PASS = String(out.verify.column).includes('banner_mascot') && String(out.verify.ledgerTop).includes('183')
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r61Apply183-result.json'), JSON.stringify(out, null, 2))
  console.log('R61_APPLY_183 ALL_PASS=' + out.ALL_PASS)
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED ' + String(e).slice(0, 300)); process.exit(1) })
