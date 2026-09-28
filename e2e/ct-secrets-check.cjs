'use strict'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
async function main() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, { headers: { Authorization: 'Bearer ' + TOKEN } })
  const j = await r.json().catch(() => ({}))
  const arr = Array.isArray(j) ? j : (j.secrets || [])
  const wanted = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'bmb_backend_production_supabase_service_role_key', 'OPENROUTER_API_KEY', 'SUPABASE_DB_URL']
  const out = {}
  for (const w of wanted) {
    const hit = arr.find((s) => s.name === w)
    out[w] = hit ? { present: true, nonempty: typeof hit.value === 'string' && hit.value.length > 0, len: hit.value ? hit.value.length : 0 } : { present: false }
  }
  console.log('status=' + r.status)
  console.log(JSON.stringify(out, null, 2))
}
main().catch((e) => { console.error('ERR', String(e).slice(0, 200)); process.exit(1) })