// e33: เช็คสถานะโพสก่อน (รอบ e32 ที่ timeout อาจ publish สำเร็จไปแล้ว) · ถ้ายังไม่ออก → dispatch ครั้งเดียว + poll เดียว 16s
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(ENV) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(ENV) || [])[1]
const GH = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e33' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const postRow = async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "SELECT status, publish_attempts AS n, error, provider_post_id AS fb, published_at::text AS pub FROM public.marketing_posts WHERE id = 'mk-mvub0nrs-fapj'" }),
  })
  return JSON.parse(await r.text())[0]
}
;(async () => {
  const before = await postRow()
  console.log('CHECK0=' + JSON.stringify(before))
  if (before && before.status === 'published') return console.log('RESULT=PUBLISHED_OK (รอบก่อนสำเร็จแล้ว)')
  const d = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/workflows/automation-scheduler.yml/dispatches', {
    method: 'POST', headers: { ...GH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { job: 'marketing' } }),
  })
  console.log('DISPATCH=' + d.status + ' (204=ok)')
  if (d.status !== 204) return
  await sleep(16000)
  const after = await postRow()
  console.log('AFTER=' + JSON.stringify(after))
  console.log(after && after.status === 'published' ? 'RESULT=PUBLISHED_OK' : 'RESULT=STILL_' + (after ? after.status : '?') + ' n=' + (after ? after.n : '?') + ' err=' + (after ? after.error : '?'))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))