// R0 follow-up: column names + schema_migrations drift + 133/134 verify (read-only)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1]?.trim()
const REF = 'ivkdfognyiwjcmrhcnwz'
const URL = `https://api.supabase.com/v1/projects/${REF}/database/query`

const QUERIES = {
  cols_drivers: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='drivers' ORDER BY ordinal_position`,
  cols_rounds: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_rounds' ORDER BY ordinal_position`,
  drivers_rows: `SELECT id, name, status, home_branch_id, (user_id IS NOT NULL) AS linked, last_seen_at FROM public.drivers ORDER BY last_seen_at DESC NULLS LAST LIMIT 10`,
  rounds_rows: `SELECT * FROM public.delivery_rounds ORDER BY id DESC LIMIT 5`,
  mig_schema: `SELECT column_name FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations' ORDER BY ordinal_position`,
  mig_versions: `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20`,
  verify_133: `SELECT count(*) AS slip_cols FROM information_schema.columns WHERE table_name='payment_intents' AND column_name IN ('slip_path','slip_uploaded_at')`,
  verify_134: `SELECT to_regprocedure('public.kitchen_fee_sync()') IS NOT NULL AS fn, (SELECT count(*) FROM information_schema.columns WHERE table_name='delivery_zones' AND column_name LIKE '%fee%') AS fee_cols`,
  verify_136_absent: `SELECT to_regclass('public.driver_location_history') AS loc_hist, to_regprocedure('public.driver_update_location(numeric,numeric,text)') AS loc_fn`,
}

const out = { generated_at: new Date().toISOString(), queries: {} }
for (const [name, query] of Object.entries(QUERIES)) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 400) } }
    out.queries[name] = { status: res.status, rows: body }
    console.log(`${name}: HTTP ${res.status}`)
  } catch (e) {
    out.queries[name] = { error: String(e) }
    console.log(`${name}: ERROR`)
  }
}
writeFileSync(join(root, 'e2e/artifacts/r0-prod-audit2.json'), JSON.stringify(out, null, 2))
console.log('WROTE r0-prod-audit2.json')
