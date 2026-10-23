// Final completeness sweep: 132/135 runtime functions + push infra (read-only)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1]?.trim()
const URL = `https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query`

const QUERIES = {
  fns_132_135: `SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('driver_attach_pod','driver_decline_assignment','admin_cancel_assignment','claim_dispatch_offer','driver_decline_offer','cancel_dispatch_offer','dispatch_order','admin_cancel_assignment','link_driver_user','upsert_driver','list_drivers') ORDER BY 1`,
  tables_132_137: `SELECT to_regclass('public.pod_photos') IS NOT NULL AS pod, to_regclass('public.push_subscriptions') IS NOT NULL AS push, to_regclass('public.dispatch_offers') IS NOT NULL AS offers, to_regclass('public.driver_location_history') AS loc_hist, to_regclass('public.marketing_posts') IS NOT NULL AS mposts`,
  buckets: `SELECT id, public FROM storage.buckets ORDER BY id`,
  auth_users_count: `SELECT count(*) AS n FROM auth.users`,
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
writeFileSync(join(root, 'e2e/artifacts/prod-sweep-final.json'), JSON.stringify(out, null, 2))
console.log('WROTE prod-sweep-final.json')
