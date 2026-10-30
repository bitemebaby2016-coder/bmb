// e61: verify R26 chain — dispatch marketing → รอ run → ดึง logs หา comment_poll + เช็ค social_events
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(ENV) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(ENV) || [])[1]
const GH = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e61' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  const d = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/workflows/automation-scheduler.yml/dispatches', {
    method: 'POST', headers: { ...GH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { job: 'marketing' } }),
  })
  console.log('DISPATCH=' + d.status)
  if (d.status !== 204) return
  await sleep(20000)
  const L = await (await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/workflows/automation-scheduler.yml/runs?per_page=3', { headers: GH })).json()
  const run = (L.workflow_runs || [])[0]
  console.log('RUN=' + (run ? run.id + ' ' + run.status + '/' + run.conclusion + ' ' + run.event : 'none'))
  if (!run) return
  const J = await (await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/' + run.id + '/jobs', { headers: GH })).json()
  const job = (J.jobs || [])[0]
  if (!job) { console.log('NO_JOB'); return }
  const lg = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/jobs/' + job.id + '/logs', { headers: GH, redirect: 'follow' })
  const text = await lg.text()
  console.log('LOG_HTTP=' + lg.status + ' len=' + text.length)
  const idx = text.indexOf('comment_poll')
  console.log('COMMENT_POLL_AT=' + idx)
  if (idx >= 0) console.log('EXCERPT=' + text.slice(Math.max(0, idx - 120), idx + 500))
  const m = text.match(/"marketing_publish"[^\n]{0,200}/)
  if (m) console.log('MKPUB=' + m[0])
  console.log('SOCIAL=' + (await q('SELECT status, count(*)::int AS n FROM public.social_events GROUP BY status ORDER BY status')))
  console.log('LATEST=' + (await q('SELECT status, event_type, left(content, 50) AS c, received_at::text AS t FROM public.social_events ORDER BY received_at DESC LIMIT 3')))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))