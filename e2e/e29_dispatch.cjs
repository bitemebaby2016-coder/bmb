// e29: dispatch automation-scheduler job=marketing แล้ว verify ทันที (GH API + DB) · อ่านจาก .env.local
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(ENV) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(ENV) || [])[1]
const GH = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-dispatch' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const d = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/workflows/automation-scheduler.yml/dispatches', {
    method: 'POST', headers: { ...GH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { job: 'marketing' } }),
  })
  console.log('DISPATCH_JOB_MARKETING=' + d.status + ' (204=ok)')
  if (d.status !== 204) return console.log('BODY=' + (await d.text()).slice(0, 300))
  await sleep(18000)
  const r = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=4', { headers: GH })
  const L = await r.json()
  const run = (L.workflow_runs || []).find((x) => x.name === 'automation-scheduler')
  console.log('NEWRUN=' + (run ? run.id + ' ' + run.event + ' ' + run.status + '/' + run.conclusion + ' sha=' + run.head_sha.slice(0, 7) : 'NOT_FOUND_YET'))
  if (run) {
    const jr = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/' + run.id + '/jobs', { headers: GH })
    const J = await jr.json()
    console.log('JOBS=' + (J.jobs || []).map((x) => x.name + ':' + x.conclusion + '[' + (x.steps || []).map((s) => s.name + '=' + s.conclusion).join(',') + ']').join(' || '))
  }
  const q = async (query) => {
    const resp = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
      method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    return resp.text()
  }
  console.log('QUEUE_TOP=' + (await q('SELECT id, job_type, status, created_at::text AS c FROM public.automation_queue ORDER BY created_at DESC LIMIT 5')))
  console.log('POST_ROW=' + (await q("SELECT id, status, scheduled_for::text AS at, publish_attempts AS n, error, updated_at::text AS upd FROM public.marketing_posts ORDER BY updated_at DESC LIMIT 3")))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))