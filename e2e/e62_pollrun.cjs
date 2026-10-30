// e62: verify จริง — enqueue แถวใหม่ + dispatch → อ่าน audit_logs g26-poll-* (ผล poll จาก production)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(ENV) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(ENV) || [])[1]
const GH = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e62' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const NEW_ID = 'sched-marketing_publish-gh-mk-poll-v1'
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  console.log('ENQ=' + (await q("SELECT public.enqueue_automation_job('" + NEW_ID + "', 'marketing_publish', 'automation-worker', '{\"limit\":10}'::jsonb, 3)")))
  const d = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/workflows/automation-scheduler.yml/dispatches', {
    method: 'POST', headers: { ...GH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { job: 'marketing' } }),
  })
  console.log('DISPATCH=' + d.status)
  if (d.status !== 204) return
  await sleep(20000)
  console.log('QROW=' + (await q("SELECT id, status, attempt_count AS a, last_error FROM public.automation_queue WHERE id = '" + NEW_ID + "'")))
  console.log('AUDIT=' + (await q("SELECT id, description, created_at::text AS t FROM public.audit_logs WHERE id LIKE 'g26-poll-%' ORDER BY created_at DESC LIMIT 3")))
  console.log('SOCIAL=' + (await q('SELECT status, count(*)::int AS n FROM public.social_events GROUP BY status ORDER BY status')))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))