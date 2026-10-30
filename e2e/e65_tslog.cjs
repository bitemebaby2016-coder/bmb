// e65: ดึง log Typecheck+Build fail ของ run 41015595741 (หา error TS/vite จริง)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const TK = (/^GITHUB_TOKEN_BMB=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const H = { Authorization: 'Bearer ' + TK, Accept: 'application/vnd.github+json', 'User-Agent': 'bmb-e65' }
;(async () => {
  const J = await (await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/41015595741/jobs', { headers: H })).json()
  const job = (J.jobs || [])[0]
  if (!job) return console.log('NO_JOB')
  const lg = await fetch('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/jobs/' + job.id + '/logs', { headers: H, redirect: 'follow' })
  const text = await lg.text()
  console.log('LOG_HTTP=' + lg.status + ' len=' + text.length)
  for (const key of ['error TS', 'Error:', 'ERROR', 'failed', 'Typecheck']) {
    let from = 0
    let hits = 0
    while (hits < 3) {
      const idx = text.indexOf(key, from)
      if (idx < 0) break
      console.log('--- ' + key + ' @' + idx + ' ---\n' + text.slice(Math.max(0, idx - 150), idx + 600))
      from = idx + key.length
      hits++
    }
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))