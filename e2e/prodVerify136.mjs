// Final verify after 136 apply (read-only)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1]?.trim()
const URL = `https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query`

const QUERIES = {
  fn_and_table: `SELECT to_regclass('public.driver_location_history') AS loc_hist, to_regprocedure('public.driver_update_location(numeric,numeric,text)') AS loc_fn`,
  grants: `SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name = 'driver_update_location' ORDER BY 1, 2`,
  policies: `SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'driver_location_history' ORDER BY policyname`,
  history_full: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 6`,
}

const out = { verified_at: new Date().toISOString(), queries: {} }
for (const [name, query] of Object.entries(QUERIES)) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.json()
  out.queries[name] = { status: res.status, rows: body }
  console.log(`${name}: HTTP ${res.status}`)
}
writeFileSync(join(root, 'e2e/artifacts/prod-verify-136.json'), JSON.stringify(out, null, 2))
console.log('WROTE prod-verify-136.json')
