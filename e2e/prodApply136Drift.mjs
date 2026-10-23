// Drift fix v2 — statements column is text[] (array literal required)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1]?.trim()
const URL = `https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query`

async function run(query, label) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 500) } }
  console.log(`${label}: HTTP ${res.status}`)
  return { label, status: res.status, body }
}

const note = '-- applied via Management API (recorded 2026-10-23)'
const results = []
results.push(await run(
  `INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ` +
  `('133','133_payment_slip_upload', ARRAY['${note}']), ` +
  `('134','134_kitchen_fee_sync', ARRAY['${note}']), ` +
  `('135','135_dispatch_offers', ARRAY['${note}']), ` +
  `('136','136_driver_location_history', ARRAY['${note}']), ` +
  `('137','137_marketing_posts_rules', ARRAY['${note}']) ` +
  `ON CONFLICT (version) DO NOTHING`,
  'record-drift-v2'))
results.push(await run(`SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 8`, 'verify-history'))

writeFileSync(join(root, 'e2e/artifacts/prod-apply-136-drift.json'), JSON.stringify({ applied_at: new Date().toISOString(), results }, null, 2))
console.log('WROTE prod-apply-136-drift.json')
