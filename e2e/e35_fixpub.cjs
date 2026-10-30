// e35: แถว t04 ถูก dedupe (ต่อชั่วโมง) → สร้างแถวใหม่ผ่าน RPC ตัวจริง (id ใหม่) → dispatch job=marketing → รอผล
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(ENV) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(ENV) || [])[1]
const GH = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e35' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const NEW_ID = 'sched-marketing_publish-gh-mk-fix-20261030t0426'
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
  console.log('DISPATCH=' + d.status + ' (204=ok)')
  if (d.status !== 204) return
  await sleep(16000)
  console.log('QROW=' + (await q("SELECT id, status, attempt_count AS a, last_error FROM public.automation_queue WHERE id = '" + NEW_ID + "'")))
  console.log('POST=' + (await q("SELECT status, publish_attempts AS n, error, provider_post_id AS fb, published_at::text AS pub FROM public.marketing_posts WHERE id = 'mk-mvub0nrs-fapj'")))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))