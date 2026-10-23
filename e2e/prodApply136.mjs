// Apply migration 136 to production (Owner-approved 2026-10-23) + record drift fix
// Channel: Management API /database/query  body {"query":"BEGIN;<file>;COMMIT;"}
// Token from .env.local — NEVER printed. Output: e2e/artifacts/prod-apply-136.json
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1]?.trim()
const REF = 'ivkdfognyiwjcmrhcnwz'
const URL = `https://api.supabase.com/v1/projects/${REF}/database/query`

async function run(query, label) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 800) } }
  console.log(`${label}: HTTP ${res.status}`)
  return { label, status: res.status, body }
}

const results = []

// 1. Apply 136 (single transaction)
const sql136 = readFileSync(join(root, 'supabase/migrations/136_driver_location_history.sql'), 'utf8')
results.push(await run(`BEGIN;\n${sql136}\nCOMMIT;`, 'apply-136'))

// 2. Verify objects exist after apply
results.push(await run(`SELECT to_regclass('public.driver_location_history') AS loc_hist, to_regprocedure('public.driver_update_location(numeric,numeric,text)') AS loc_fn`, 'verify-136'))

// 3. Drift repair (Owner-approved): record 133-137 in supabase_migrations.schema_migrations
//    (133/134/135/137 objects already live but history stops at 132 — replay safety)
results.push(await run(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('133','133_payment_slip_upload','-- applied via Management API (see e2e/prod-apply-result.json)'), ('134','134_kitchen_fee_sync','-- applied via Management API (see e2e/prod-apply-result.json)'), ('135','135_dispatch_offers','-- applied via Management API (see e2e/prod-apply-result.json)'), ('136','136_driver_location_history','-- applied via Management API (this run)'), ('137','137_marketing_posts_rules','-- applied via Management API (see AI_WORK_STATE chunk9)') ON CONFLICT (version) DO NOTHING`, 'record-drift-133-137'))

// 4. Verify history now complete
results.push(await run(`SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 8`, 'verify-history'))

writeFileSync(join(root, 'e2e/artifacts/prod-apply-136.json'), JSON.stringify({ applied_at: new Date().toISOString(), results }, null, 2))
console.log('WROTE e2e/artifacts/prod-apply-136.json')
