// G8-S0 — read-only production DB audit (schema metadata only; no DML, no secrets printed)
const fs = require('fs')
const env = fs.readFileSync('supabase/secrets.local.env', 'utf8')
const SERVICE = (/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(env) || [])[1]
if (!SERVICE) { console.log('NO_SERVICE_KEY'); process.exit(1) }
const url = 'https://ivkdfognyiwjcmrhcnwz.supabase.co/rest/v1/'
async function rpcOrGet(path, select) {
  const r = await fetch(url + path, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  return { status: r.status, j: await r.json().catch(() => null) }
}
;(async () => {
  // candidate tables probe (404 = absent in public schema)
  const candidates = ['notifications','audit_logs','content_approvals','ai_usage','ai_usage_logs',
    'automation_jobs','automation_runs','jobs','job_queue','queue','queued_jobs','scheduled_jobs',
    'job_runs','dead_letter','dead_letter_queue','social_posts','social_drafts','worker_registrations']
  const present = []
  for (const t of candidates) {
    const c = await fetch(url + t + '?select=*&limit=1', { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, Prefer: 'count=exact', Range: '0-0' } })
    if (c.status === 200 || c.status === 206) {
      const rows = await c.json()
      present.push(t)
      const total = (c.headers.get('content-range') || '').split('/')[1]
      console.log('TABLE ' + t + ' rows=' + total + ' cols=' + Object.keys(rows[0] || {}).join('|'))
    } else if (c.status !== 404) {
      console.log('TABLE ' + t + ' status=' + c.status)
    }
  }
  // security-definer RPC probe (404 = absent; 400/405 = exists)
  const rpcs = ['review_content','dispatch_notifications','run_automation','enqueue_job','claim_job','complete_job','retry_job']
  for (const r of rpcs) {
    const c = await fetch(url + 'rpc/' + r, { method: 'POST', headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' }, body: '{}' })
    if (c.status === 404) continue
    const body = await c.text()
    console.log('RPC ' + r + ' status=' + c.status + (c.status === 404 ? '' : ' body=' + body.slice(0, 120)))
  }
  // counts for durable traces
  for (const [name, path] of [['AUDIT_AUTOMATION_EXEC', "audit_logs?select=id&action=eq.automation.execution"], ['AUDIT_G7_DRAFT', "audit_logs?select=id&action=eq.g7.draft"], ['CONTENT_APPROVALS', 'content_approvals?select=id']]) {
    const c = await fetch(url + path, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, Prefer: 'count=exact', Range: '0-0' } })
    console.log(name + '=' + (c.headers.get('content-range') || '').split('/')[1])
  }
})().catch(e => { console.log('AUDIT_ERR ' + e.message); process.exit(1) })