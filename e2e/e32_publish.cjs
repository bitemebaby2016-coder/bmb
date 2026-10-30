// e32: หลัง deploy worker ใหม่ → dispatch marketing อีกรอบ แล้วรอจนแถวโพสเปลี่ยนสถานะ (published หรือ attempts ขึ้น)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(ENV) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(ENV) || [])[1]
const GH = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e32' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const postRow = async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "SELECT status, publish_attempts AS n, error, provider_post_id AS fb, published_at::text AS pub FROM public.marketing_posts WHERE id = 'mk-mvub0nrs-fapj'" }),
  })
  return JSON.parse(await r.text())[0]
}
;(async () => {
  const d = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/workflows/automation-scheduler.yml/dispatches', {
    method: 'POST', headers: { ...GH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { job: 'marketing' } }),
  })
  console.log('DISPATCH_MARKETING=' + d.status + ' (204=ok)')
  if (d.status !== 204) return
  for (let i = 0; i < 4; i++) {
    await sleep(i === 0 ? 14000 : 4000)
    const row = await postRow()
    console.log('POLL' + (i + 1) + '=' + JSON.stringify(row))
    if (row && row.status === 'published') return console.log('RESULT=PUBLISHED_OK')
  }
  console.log('RESULT=NOT_PUBLISHED_YET (ดูแถวข้างบน: n ขึ้น = retry ถูกยิง · error เดิม = deploy ยังไม่ถูกเรียก)')
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))